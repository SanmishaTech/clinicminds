import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { updateTransportSchema, transportStatusSchema, type UpdateTransportInput } from '@/lib/schemas/backend/transports';
import { ROLES } from '@/config/roles';
import { z } from 'zod';

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

function toIsoDate(d: unknown): string | null {
  if (!d) return null;
  const dt = new Date(d as any);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

// GET /api/transports/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError('Invalid transport id', 400);

  try {
    const transport = await (prisma as any).transport.findUnique({
      where: { id: idNum },
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
        notes: true,
        dispatchedAt: true,
        deliveredAt: true,
        stockPostedAt: true,
        transportDetails: {
          select: {
            saleDetailId: true,
            quantity: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        sale: {
          select: {
            invoiceNo: true,
            invoiceDate: true,
            totalAmount: true,
          },
        },
        franchise: { select: { name: true } },
      },
    });

    if (!transport) return ApiError('Transport not found', 404);

    if (auth.user.role === ROLES.FRANCHISE) {
      const franchiseId = await getCurrentFranchiseId(auth.user.id);
      if (!franchiseId) return ApiError('Current user is not associated with any franchise', 400);
      if (transport.franchiseId !== franchiseId) return ApiError('Forbidden', 403);
    }

    return Success(transport);
  } catch (e) {
    console.error('Error fetching transport:', e);
    return ApiError('Failed to fetch transport');
  }
}

// PATCH /api/transports/:id
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError('Invalid transport id', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError('Invalid JSON body', 400);
  }

  // Franchise: only allowed to mark DELIVERED
  if (auth.user.role === ROLES.FRANCHISE) {
    const deliverSchema = z.object({ status: transportStatusSchema });
    const parsed = deliverSchema.safeParse(body);
    if (!parsed.success) return BadRequest(parsed.error.errors);

    if (String(parsed.data.status).toUpperCase() !== 'DELIVERED') {
      return ApiError('Franchise can only mark as DELIVERED', 400);
    }

    try {
      const res = await prisma.$transaction(async (tx: any) => {
        const franchiseId = await getCurrentFranchiseId(auth.user.id);
        if (!franchiseId) return { error: 'NO_FRANCHISE' } as const;

        const transport = await tx.transport.findUnique({
          where: { id: idNum },
          select: {
            id: true,
            saleId: true,
            franchiseId: true,
            status: true,
            stockPostedAt: true,
            dispatchedQuantity: true,
            transportDetails: {
              select: {
                saleDetailId: true,
                quantity: true,
              },
            },
          },
        });
        if (!transport) return { error: 'NOT_FOUND' } as const;
        if (transport.franchiseId !== franchiseId) return { error: 'FORBIDDEN' } as const;

        const currentStatus = String(transport.status || '').toUpperCase();
        if (currentStatus === 'DELIVERED') {
          const t = await tx.transport.findUnique({ where: { id: idNum } });
          return { ok: true, transport: t } as const;
        }
        if (currentStatus !== 'DISPATCHED') return { error: 'NOT_DISPATCHED' } as const;

        const sale = await tx.sale.findUnique({
          where: { id: transport.saleId },
          include: { saleDetails: true },
        });
        if (!sale) return { error: 'SALE_NOT_FOUND' } as const;
        const saleDetails = sale.saleDetails || [];
        const saleDetailMap = new Map<number, (typeof saleDetails)[number]>();
        const totalSaleQty = saleDetails.reduce((sum: number, d: any) => {
          saleDetailMap.set(Number(d.id), d);
          return sum + (Number(d.quantity) || 0);
        }, 0);

        const dispatchedDetails: Array<{
          medicineId: number;
          batchNumber: string | null;
          expiryDate: Date | null;
          quantity: number;
          rate: number;
          amount: number;
        }> = [];

        const transportDetails = transport.transportDetails || [];

        if (transportDetails.length > 0) {
          for (const detail of transportDetails) {
            const saleDetail = saleDetailMap.get(Number(detail.saleDetailId));
            if (!saleDetail) return { error: 'INVALID_TRANSPORT_DETAILS' } as const;
            const qty = Number(detail.quantity) || 0;
            const saleQty = Number(saleDetail.quantity) || 0;
            if (qty > saleQty) return { error: 'DISPATCHED_QTY_EXCEEDS_SALE_DETAIL' } as const;
            if (qty <= 0) continue;
            const rate = Number(saleDetail.rate) || 0;
            dispatchedDetails.push({
              medicineId: Number(saleDetail.medicineId),
              batchNumber: saleDetail.batchNumber ?? null,
              expiryDate: saleDetail.expiryDate ? new Date(saleDetail.expiryDate) : null,
              quantity: qty,
              rate,
              amount: rate * qty,
            });
          }
        } else {
          const requestedDispatchQtyRaw = Number(transport.dispatchedQuantity ?? 0) || 0;
          const requestedDispatchQty = requestedDispatchQtyRaw > 0 ? requestedDispatchQtyRaw : totalSaleQty;

          if (requestedDispatchQty > totalSaleQty) return { error: 'DISPATCHED_QTY_EXCEEDS_SALE' } as const;

          let remaining = requestedDispatchQty;
          for (const d of saleDetails) {
            if (remaining <= 0) break;
            const q = Math.min(remaining, Number(d.quantity) || 0);
            if (q <= 0) continue;
            const rate = Number(d.rate) || 0;
            dispatchedDetails.push({
              medicineId: Number(d.medicineId),
              batchNumber: d.batchNumber ?? null,
              expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
              quantity: q,
              rate,
              amount: rate * q,
            });
            remaining -= q;
          }
        }

        if (dispatchedDetails.length === 0) return { error: 'DISPATCHED_DETAILS_REQUIRED' } as const;

        const now = new Date();

        const updatedTransport = await tx.transport.update({
          where: { id: idNum },
          data: { status: 'DELIVERED', deliveredAt: now },
        });

        if (!transport.stockPostedAt) {
          const existingStockTxn = await tx.stockTransaction.findUnique({
            where: { saleId: sale.id },
            select: { id: true },
          });

          const adminQtyByMedicineId = new Map<number, number>();
          for (const d of dispatchedDetails) {
            adminQtyByMedicineId.set(d.medicineId, (adminQtyByMedicineId.get(d.medicineId) ?? 0) + d.quantity);
          }

          for (const [medicineId, qty] of adminQtyByMedicineId.entries()) {
            const adminBal = await (tx as any).adminStockBalance.findUnique({
              where: { medicineId },
              select: { quantity: true },
            });
            const available = Number(adminBal?.quantity ?? 0);
            if (available < qty) {
              return { error: 'INSUFFICIENT_ADMIN_STOCK', medicineId, available, required: qty } as const;
            }
          }

          for (const [medicineId, qty] of adminQtyByMedicineId.entries()) {
            await (tx as any).adminStockBalance.upsert({
              where: { medicineId },
              create: { medicineId, quantity: -qty },
              update: { quantity: { decrement: qty } },
              select: { id: true },
            });
          }

          const stockTxn = existingStockTxn
            ? await tx.stockTransaction.update({
                where: { id: existingStockTxn.id },
                data: {
                  txnDate: sale.invoiceDate,
                  franchiseId: sale.franchiseId,
                },
                select: { id: true },
              })
            : await tx.stockTransaction.create({
                data: {
                  txnType: 'SALE_TO_FRANCHISE',
                  txnNo: '',
                  txnDate: sale.invoiceDate,
                  franchiseId: sale.franchiseId,
                  createdByUserId: auth.user.id,
                  saleId: sale.id,
                  notes: null,
                },
                select: { id: true },
              });

          await tx.stockLedger.createMany({
            data: dispatchedDetails.map((detail: any) => ({
              transactionId: stockTxn.id,
              franchiseId: sale.franchiseId,
              medicineId: detail.medicineId,
              batchNumber: detail.batchNumber,
              expiryDate: detail.expiryDate,
              qtyChange: detail.quantity,
              rate: detail.rate,
              amount: detail.amount,
            })),
          });

          const qtyByMedicineId = new Map<number, number>();
          const qtyByBatchKey = new Map<string, { franchiseId: number; medicineId: number; batchNumber: string; expiryDate: Date; qty: number }>();

          for (const d of dispatchedDetails) {
            qtyByMedicineId.set(d.medicineId, (qtyByMedicineId.get(d.medicineId) ?? 0) + d.quantity);
            if (d.batchNumber && d.expiryDate) {
              const key = `${sale.franchiseId}:${d.medicineId}:${d.batchNumber}:${new Date(d.expiryDate).toISOString()}`;
              const existing = qtyByBatchKey.get(key);
              if (existing) {
                existing.qty += d.quantity;
              } else {
                qtyByBatchKey.set(key, {
                  franchiseId: sale.franchiseId,
                  medicineId: d.medicineId,
                  batchNumber: d.batchNumber,
                  expiryDate: new Date(d.expiryDate),
                  qty: d.quantity,
                });
              }
            }
          }

          for (const [medicineId2, qty] of qtyByMedicineId.entries()) {
            await tx.stockBalance.upsert({
              where: {
                franchiseId_medicineId: {
                  franchiseId: sale.franchiseId,
                  medicineId: medicineId2,
                },
              },
              create: {
                franchiseId: sale.franchiseId,
                medicineId: medicineId2,
                quantity: qty,
              },
              update: {
                quantity: { increment: qty },
              },
            });
          }

          for (const entry of qtyByBatchKey.values()) {
            await tx.stockBatchBalance.upsert({
              where: {
                franchiseId_medicineId_batchNumber_expiryDate: {
                  franchiseId: entry.franchiseId,
                  medicineId: entry.medicineId,
                  batchNumber: entry.batchNumber,
                  expiryDate: entry.expiryDate,
                },
              },
              create: {
                franchiseId: entry.franchiseId,
                medicineId: entry.medicineId,
                batchNumber: entry.batchNumber,
                expiryDate: entry.expiryDate,
                quantity: entry.qty,
              },
              update: {
                quantity: { increment: entry.qty },
              },
            });
          }

          await tx.transport.update({
            where: { id: idNum },
            data: { stockPostedAt: now },
            select: { id: true },
          });
        }

        return { ok: true, transport: updatedTransport } as const;
      });

      if ((res as any).error === 'NO_FRANCHISE') return ApiError('Current user is not associated with any franchise', 400);
      if ((res as any).error === 'NOT_FOUND') return ApiError('Transport not found', 404);
      if ((res as any).error === 'FORBIDDEN') return ApiError('Forbidden', 403);
      if ((res as any).error === 'NOT_DISPATCHED') return ApiError('Transport must be DISPATCHED before DELIVERED', 409);
      if ((res as any).error === 'INSUFFICIENT_ADMIN_STOCK') return ApiError('Insufficient admin stock to post delivery', 409);
      if ((res as any).error === 'DISPATCHED_DETAILS_REQUIRED') return ApiError('Dispatched details are required', 400);
      if ((res as any).error === 'INVALID_TRANSPORT_DETAILS') return ApiError('Invalid transport details', 400);
      if ((res as any).error === 'DISPATCHED_QTY_EXCEEDS_SALE_DETAIL') {
        return ApiError('Dispatched quantity exceeds sale detail quantity', 400);
      }
      if ((res as any).error === 'DISPATCHED_QTY_EXCEEDS_SALE') return ApiError('Dispatched quantity exceeds sale quantity', 400);
      if ((res as any).error === 'SALE_NOT_FOUND') return ApiError('Sale not found', 404);

      return Success((res as any).transport);
    } catch (e) {
      console.error('Deliver transport error:', e);
      return ApiError((e as Error).message || 'Failed to mark delivered');
    }
  }

  // Admin: update details
  if (auth.user.role !== ROLES.ADMIN) {
    return ApiError('Unauthorized role', 403);
  }

  try {
    const data = updateTransportSchema.parse(body) as UpdateTransportInput;

    if (data.status && String(data.status).toUpperCase() === 'DELIVERED') {
      return ApiError('DELIVERED must be set by franchise', 400);
    }

    const now = new Date();
    const statusUpper = data.status ? String(data.status).toUpperCase() : undefined;

    const updated = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.transport.findUnique({
        where: { id: idNum },
        select: { id: true, status: true, saleId: true, franchiseId: true },
      });
      if (!existing) return null;
      if (String(existing.status || '').toUpperCase() === 'DELIVERED') {
        throw new Error('TRANSPORT_ALREADY_DELIVERED');
      }

      if (String(existing.status || '').toUpperCase() !== 'PENDING') {
        throw new Error('ONLY_PENDING_CAN_BE_UPDATED');
      }

      const sale = await tx.sale.findUnique({
        where: { id: existing.saleId },
        select: {
          id: true,
          franchiseId: true,
          saleDetails: { select: { id: true, quantity: true } },
        },
      });
      if (!sale) throw new Error('SALE_NOT_FOUND');

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

      let dispatchedDetailsToSave: Array<{ saleDetailId: number; quantity: number }> | null = null;
      let computedDispatchedQty: number | undefined;

      if ((data.dispatchedDetails && data.dispatchedDetails.length > 0) || data.dispatchedQuantity !== undefined) {
        const saleDetails = sale.saleDetails || [];
        const saleDetailMap = new Map<number, { quantity: number }>();
        const totalSaleQty = saleDetails.reduce((sum: number, d: any) => {
          const qty = Number(d.quantity) || 0;
          saleDetailMap.set(Number(d.id), { quantity: qty });
          return sum + qty;
        }, 0);

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

          const computedDetails = saleDetails.map((detail) => {
            const saleDetailId = Number(detail.id);
            const qty = payloadMap.get(saleDetailId) ?? 0;
            const remaining = remainingBySaleDetailId.get(saleDetailId) ?? 0;
            if (qty > remaining) throw new Error('DISPATCHED_QTY_EXCEEDS_REMAINING');
            return { saleDetailId, quantity: qty };
          });

          const totalDispatchedQty = computedDetails.reduce((sum, detail) => sum + (Number(detail.quantity) || 0), 0);
          if (totalDispatchedQty <= 0) throw new Error('DISPATCHED_DETAILS_REQUIRED');

          dispatchedDetailsToSave = computedDetails;
          computedDispatchedQty = totalDispatchedQty;
        } else if (data.dispatchedQuantity !== undefined) {
          const requestedDispatchQty = Number(data.dispatchedQuantity) || 0;
          if (requestedDispatchQty > totalRemainingQty) throw new Error('DISPATCHED_QTY_EXCEEDS_REMAINING');

          let remaining = requestedDispatchQty;
          dispatchedDetailsToSave = saleDetails.map((detail) => {
            const saleDetailId = Number(detail.id);
            const maxQty = remainingBySaleDetailId.get(saleDetailId) ?? 0;
            const qty = remaining > 0 ? Math.min(remaining, maxQty) : 0;
            remaining -= qty;
            return { saleDetailId, quantity: qty };
          });
          computedDispatchedQty = requestedDispatchQty;
        }
      }

      const patch: any = {
        transporterName: data.transporterName ?? undefined,
        companyName: data.companyName ?? undefined,
        transportFee: data.transportFee ?? undefined,
        receiptNumber: data.receiptNumber ?? undefined,
        vehicleNumber: data.vehicleNumber ?? undefined,
        trackingNumber: data.trackingNumber ?? undefined,
        notes: data.notes ?? undefined,
        franchiseId: sale.franchiseId,
      };

      if (computedDispatchedQty !== undefined) {
        patch.dispatchedQuantity = computedDispatchedQty;
      }

      if (statusUpper) {
        patch.status = statusUpper;
        if (statusUpper === 'DISPATCHED') patch.dispatchedAt = now;
      }

      const updatedTransport = await tx.transport.update({ where: { id: idNum }, data: patch });

      if (dispatchedDetailsToSave) {
        await tx.transportDetail.deleteMany({ where: { transportId: existing.id } });
        await tx.transportDetail.createMany({
          data: dispatchedDetailsToSave.map((detail) => ({
            transportId: existing.id,
            saleDetailId: detail.saleDetailId,
            quantity: detail.quantity,
          })),
        });
      }

      if (statusUpper === 'DISPATCHED') {
        const saleDetails = sale.saleDetails || [];
        const dispatchedSumBySaleDetailId = new Map<number, number>();
        for (const [k, v] of alreadyDispatchedBySaleDetailId.entries()) {
          dispatchedSumBySaleDetailId.set(k, v);
        }

        for (const row of dispatchedDetailsToSave || []) {
          const sid = Number(row.saleDetailId);
          const q = Number(row.quantity) || 0;
          dispatchedSumBySaleDetailId.set(sid, (dispatchedSumBySaleDetailId.get(sid) ?? 0) + q);
        }

        const remainderDetails = saleDetails
          .map((detail) => {
            const saleDetailId = Number(detail.id);
            const saleQty = Number(detail.quantity) || 0;
            const dispatchedQty = dispatchedSumBySaleDetailId.get(saleDetailId) ?? 0;
            return {
              saleDetailId,
              quantity: Math.max(0, saleQty - dispatchedQty),
            };
          })
          .filter((d) => (Number(d.quantity) || 0) > 0);

        const remainderTotal = remainderDetails.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);

        if (remainderTotal > 0) {
          const pendingRemainder = await tx.transport.findFirst({
            where: { saleId: sale.id, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          const pendingRemainderId = pendingRemainder
            ? pendingRemainder.id
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
      }

      return updatedTransport;
    });

    if (!updated) return ApiError('Transport not found', 404);
    return Success(updated);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as Error;
    if (err.message === 'TRANSPORT_ALREADY_DELIVERED') return ApiError('Transport already delivered', 409);
    if (err.message === 'ONLY_PENDING_CAN_BE_UPDATED') return ApiError('Only PENDING transports can be updated', 409);
    if (err.message === 'SALE_NOT_FOUND') return ApiError('Sale not found', 404);
    if (err.message === 'DISPATCHED_QTY_EXCEEDS_REMAINING') return ApiError('Dispatched quantity exceeds remaining quantity', 400);
    if (err.message === 'DISPATCHED_DETAILS_REQUIRED') return ApiError('Dispatched details are required', 400);
    if (err.message === 'INVALID_SALE_DETAIL') return ApiError('Invalid sale detail for dispatch', 400);
    if (err.message === 'DUPLICATE_SALE_DETAIL') return ApiError('Duplicate sale detail provided', 400);
    console.error('Update transport error:', e);
    return ApiError('Failed to update transport');
  }
}
