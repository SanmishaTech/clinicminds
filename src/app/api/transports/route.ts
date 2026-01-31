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

      const alreadyDispatched = await tx.transportDetail.findMany({
        where: {
          transport: {
            saleId: sale.id,
            status: { in: ['DISPATCHED', 'DELIVERED'] },
          },
        },
        select: { saleDetailId: true, quantity: true },
      });

      const alreadyDispatchedBySaleDetailId = new Map<number, number>();
      for (const row of alreadyDispatched) {
        const sid = Number(row.saleDetailId);
        const q = Number(row.quantity) || 0;
        alreadyDispatchedBySaleDetailId.set(sid, (alreadyDispatchedBySaleDetailId.get(sid) ?? 0) + q);
      }

      const remainingBySaleDetailId = new Map<number, number>();
      let totalRemainingQty = 0;
      for (const d of saleDetails) {
        const saleDetailId = Number(d.id);
        const saleQty = Number(d.quantity) || 0;
        const alreadyQty = alreadyDispatchedBySaleDetailId.get(saleDetailId) ?? 0;
        const remaining = Math.max(0, saleQty - alreadyQty);
        remainingBySaleDetailId.set(saleDetailId, remaining);
        totalRemainingQty += remaining;
      }

      if (totalSaleQty > 0 && totalRemainingQty <= 0) {
        throw new Error('ALREADY_FULLY_DISPATCHED');
      }

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
          const remaining = remainingBySaleDetailId.get(saleDetailId) ?? 0;
          if (qty > remaining) throw new Error('DISPATCHED_QTY_EXCEEDS_REMAINING');
          return { saleDetailId, quantity: qty };
        });
      } else {
        const requestedDispatchQty = Number(data.dispatchedQuantity ?? 0) || 0;
        if (requestedDispatchQty > totalRemainingQty) throw new Error('DISPATCHED_QTY_EXCEEDS_REMAINING');

        let remaining = requestedDispatchQty;
        dispatchedDetails = saleDetails.map((detail) => {
          const saleDetailId = Number(detail.id);
          const maxQty = remainingBySaleDetailId.get(saleDetailId) ?? 0;
          const qty = remaining > 0 ? Math.min(remaining, maxQty) : 0;
          remaining -= qty;
          return { saleDetailId, quantity: qty };
        });
      }

      const totalDispatchedQty = dispatchedDetails.reduce((sum, detail) => sum + (Number(detail.quantity) || 0), 0);

      if (!dispatchedDetails || dispatchedDetails.length === 0 || totalDispatchedQty <= 0) {
        throw new Error('DISPATCHED_DETAILS_REQUIRED');
      }

      const now = new Date();

      const pendingToDispatch = data.transportId
        ? await tx.transport.findFirst({
            where: { id: data.transportId, saleId: sale.id, status: 'PENDING' },
            select: { id: true },
          })
        : await tx.transport.findFirst({
            where: { saleId: sale.id, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

      const pendingId = pendingToDispatch
        ? pendingToDispatch.id
        : (
            await tx.transport.create({
              data: { saleId: sale.id, franchiseId: sale.franchiseId, status: 'PENDING' },
              select: { id: true },
            })
          ).id;

      const createdOrUpdated = await tx.transport.update({
        where: { id: pendingId },
        data: {
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
      });

      await tx.transportDetail.deleteMany({ where: { transportId: createdOrUpdated.id } });
      await tx.transportDetail.createMany({
        data: dispatchedDetails
          .filter((d) => (Number(d.quantity) || 0) > 0)
          .map((detail) => ({
            transportId: createdOrUpdated.id,
            saleDetailId: detail.saleDetailId,
            quantity: detail.quantity,
          })),
      });

      for (const d of dispatchedDetails) {
        const saleDetailId = Number(d.saleDetailId);
        const prev = remainingBySaleDetailId.get(saleDetailId) ?? 0;
        remainingBySaleDetailId.set(saleDetailId, Math.max(0, prev - (Number(d.quantity) || 0)));
      }

      const remainderDetails = saleDetails
        .map((detail) => ({
          saleDetailId: Number(detail.id),
          quantity: remainingBySaleDetailId.get(Number(detail.id)) ?? 0,
        }))
        .filter((d) => (Number(d.quantity) || 0) > 0);

      const remainderTotal = remainderDetails.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);

      if (remainderTotal > 0) {
        const otherPending = await tx.transport.findFirst({
          where: { saleId: sale.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });

        const pendingRemainderId = otherPending
          ? otherPending.id
          : (
              await tx.transport.create({
                data: { saleId: sale.id, franchiseId: sale.franchiseId, status: 'PENDING' },
                select: { id: true },
              })
            ).id;

        await tx.transportDetail.deleteMany({ where: { transportId: pendingRemainderId } });
        await tx.transportDetail.createMany({
          data: remainderDetails.map((detail) => ({
            transportId: pendingRemainderId,
            saleDetailId: detail.saleDetailId,
            quantity: detail.quantity,
          })),
        });
      } else {
        await tx.transport.deleteMany({ where: { saleId: sale.id, status: 'PENDING' } });
      }

      return createdOrUpdated;
    });

    return Success(result, 201);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as Error;
    if (err.message === 'SALE_NOT_FOUND') return ApiError('Sale not found', 404);
    if (err.message === 'ALREADY_FULLY_DISPATCHED') return ApiError('Sale is already fully dispatched', 409);
    if (err.message === 'DISPATCHED_QTY_EXCEEDS_REMAINING') return ApiError('Dispatched quantity exceeds remaining quantity', 400);
    if (err.message === 'DISPATCHED_DETAILS_REQUIRED') return ApiError('Dispatched details are required', 400);
    if (err.message === 'INVALID_SALE_DETAIL') return ApiError('Invalid sale detail for dispatch', 400);
    if (err.message === 'DUPLICATE_SALE_DETAIL') return ApiError('Duplicate sale detail provided', 400);
    console.error('Create/update transport error:', e);
    return ApiError('Failed to save transport');
  }
}
