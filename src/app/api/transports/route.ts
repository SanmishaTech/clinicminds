import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { createTransportSchema, type CreateTransportInput } from '@/lib/schemas/backend/transports';
import { ROLES } from '@/config/roles';
import { z } from 'zod';

const transportModel = (prisma as any).transport;

async function getCurrentFranchiseId(userId: number): Promise<number | null> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      franchise: { select: { id: true } },
      team: { select: { franchise: { select: { id: true } } } },
    },
  });
  return currentUser?.franchise?.id || currentUser?.team?.franchise?.id || null;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const status = (searchParams.get('status') || '').trim().toUpperCase();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));

  try {
    const where: any = {};

    if (auth.user.role === ROLES.FRANCHISE) {
      const franchiseId = await getCurrentFranchiseId(auth.user.id);
      if (!franchiseId) return ApiError('Current user is not associated with any franchise', 400);
      where.franchiseId = franchiseId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { receiptNumber: { contains: search } },
        { trackingNumber: { contains: search } },
        { transporterName: { contains: search } },
        { companyName: { contains: search } },
        { sale: { invoiceNo: { contains: search } } },
        { franchise: { name: { contains: search } } },
      ];
    }

    const result = await paginate({
      model: transportModel,
      where,
      orderBy: { createdAt: 'desc' },
      page,
      perPage,
      select: {
        id: true,
        saleId: true,
        franchiseId: true,
        status: true,
        dispatchedQuantity: true,
        transporterName: true,
        companyName: true,
        transportFee: true,
        receiptNumber: true,
        vehicleNumber: true,
        trackingNumber: true,
        dispatchedAt: true,
        deliveredAt: true,
        stockPostedAt: true,
        createdAt: true,
        updatedAt: true,
        sale: {
          select: {
            invoiceNo: true,
            invoiceDate: true,
            totalAmount: true,
            saleDetails: {
              select: {
                quantity: true,
              },
            },
          },
        },
        franchise: {
          select: {
            name: true,
          },
        },
      },
    });

    return Success(result);
  } catch (e) {
    console.error('Error fetching transports:', e);
    return ApiError('Failed to fetch transports');
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  if (auth.user.role !== ROLES.ADMIN) {
    return ApiError('Unauthorized role', 403);
  }

  try {
    const body = await req.json();
    const data = createTransportSchema.parse(body) as CreateTransportInput;

    const result = await prisma.$transaction(async (tx: any) => {
      const sale = await tx.sale.findUnique({
        where: { id: data.saleId },
        select: {
          id: true,
          franchiseId: true,
          saleDetails: {
            select: {
              id: true,
              quantity: true,
            },
          },
        },
      });
      if (!sale) throw new Error('SALE_NOT_FOUND');

      const saleDetails = sale.saleDetails || [];
      const saleDetailMap = new Map<number, { quantity: number }>();
      const totalSaleQty = saleDetails.reduce((sum: number, d: any) => {
        const qty = Number(d.quantity) || 0;
        saleDetailMap.set(Number(d.id), { quantity: qty });
        return sum + qty;
      }, 0);

      let dispatchedDetails: Array<{ saleDetailId: number; quantity: number }> = [];

      if (data.dispatchedDetails && data.dispatchedDetails.length > 0) {
        const payloadMap = new Map<number, number>();
        for (const detail of data.dispatchedDetails) {
          const saleDetailId = Number(detail.saleDetailId);
          if (payloadMap.has(saleDetailId)) throw new Error('DUPLICATE_SALE_DETAIL');
          payloadMap.set(saleDetailId, Number(detail.quantity) || 0);
        }

        for (const saleDetailId of payloadMap.keys()) {
          if (!saleDetailMap.has(saleDetailId)) throw new Error('INVALID_SALE_DETAIL');
        }

        dispatchedDetails = saleDetails.map((detail) => {
          const saleDetailId = Number(detail.id);
          const qty = payloadMap.get(saleDetailId) ?? 0;
          const saleDetail = saleDetailMap.get(saleDetailId);
          if (saleDetail && qty > saleDetail.quantity) throw new Error('DISPATCHED_QTY_EXCEEDS_SALE_DETAIL');
          return { saleDetailId, quantity: qty };
        });
      } else {
        const requestedDispatchQty = Number(data.dispatchedQuantity ?? 0) || 0;
        if (requestedDispatchQty > totalSaleQty) {
          throw new Error('DISPATCHED_QTY_EXCEEDS_SALE');
        }

        let remaining = requestedDispatchQty;
        dispatchedDetails = saleDetails.map((detail) => {
          const saleDetailId = Number(detail.id);
          const qty = remaining > 0 ? Math.min(remaining, Number(detail.quantity) || 0) : 0;
          remaining -= qty;
          return { saleDetailId, quantity: qty };
        });
      }

      const totalDispatchedQty = dispatchedDetails.reduce((sum, detail) => sum + (Number(detail.quantity) || 0), 0);

      if (!dispatchedDetails || dispatchedDetails.length === 0 || totalDispatchedQty <= 0) {
        throw new Error('DISPATCHED_DETAILS_REQUIRED');
      }

      const existing = await tx.transport.findUnique({
        where: { saleId: sale.id },
        select: { id: true, status: true },
      });
      if (existing?.status === 'DELIVERED') {
        throw new Error('TRANSPORT_ALREADY_DELIVERED');
      }

      const now = new Date();

      const createdOrUpdated = await tx.transport.upsert({
        where: { saleId: sale.id },
        create: {
          saleId: sale.id,
          franchiseId: sale.franchiseId,
          status: 'DISPATCHED',
          dispatchedAt: now,
          dispatchedQuantity: totalDispatchedQty,
          transporterName: data.transporterName || null,
          companyName: data.companyName || null,
          transportFee: data.transportFee ?? null,
          receiptNumber: data.receiptNumber || null,
          vehicleNumber: data.vehicleNumber || null,
          trackingNumber: data.trackingNumber || null,
          notes: data.notes || null,
        },
        update: {
          franchiseId: sale.franchiseId,
          status: 'DISPATCHED',
          dispatchedAt: now,
          dispatchedQuantity: totalDispatchedQty,
          transporterName: data.transporterName || null,
          companyName: data.companyName || null,
          transportFee: data.transportFee ?? null,
          receiptNumber: data.receiptNumber || null,
          vehicleNumber: data.vehicleNumber || null,
          trackingNumber: data.trackingNumber || null,
          notes: data.notes || null,
        },
      });

      await tx.transportDetail.deleteMany({ where: { transportId: createdOrUpdated.id } });
      await tx.transportDetail.createMany({
        data: dispatchedDetails.map((detail) => ({
          transportId: createdOrUpdated.id,
          saleDetailId: detail.saleDetailId,
          quantity: detail.quantity,
        })),
      });

      return createdOrUpdated;
    });

    return Success(result, 201);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as Error;
    if (err.message === 'SALE_NOT_FOUND') return ApiError('Sale not found', 404);
    if (err.message === 'TRANSPORT_ALREADY_DELIVERED') return ApiError('Transport already delivered', 409);
    if (err.message === 'DISPATCHED_QTY_EXCEEDS_SALE') return ApiError('Dispatched quantity exceeds sale quantity', 400);
    if (err.message === 'DISPATCHED_QTY_EXCEEDS_SALE_DETAIL') return ApiError('Dispatched quantity exceeds sale detail quantity', 400);
    if (err.message === 'DISPATCHED_DETAILS_REQUIRED') return ApiError('Dispatched details are required', 400);
    if (err.message === 'INVALID_SALE_DETAIL') return ApiError('Invalid sale detail for dispatch', 400);
    if (err.message === 'DUPLICATE_SALE_DETAIL') return ApiError('Duplicate sale detail provided', 400);
    console.error('Create/update transport error:', e);
    return ApiError('Failed to save transport');
  }
}
