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
          select: { id: true, saleId: true, franchiseId: true, status: true, stockPostedAt: true },
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
          for (const d of sale.saleDetails || []) {
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

          const existingLedgerLines = await tx.stockLedger.findMany({
            where: { transactionId: stockTxn.id },
            select: { franchiseId: true, medicineId: true, batchNumber: true, expiryDate: true, qtyChange: true },
          });

          // reverse any existing ledger impact (safety)
          for (const line of existingLedgerLines) {
            await tx.stockBalance.upsert({
              where: {
                franchiseId_medicineId: {
                  franchiseId: line.franchiseId,
                  medicineId: line.medicineId,
                },
              },
              create: {
                franchiseId: line.franchiseId,
                medicineId: line.medicineId,
                quantity: -(line.qtyChange || 0),
              },
              update: {
                quantity: { decrement: line.qtyChange || 0 },
              },
            });

            if (line.batchNumber && line.expiryDate) {
              await tx.stockBatchBalance.upsert({
                where: {
                  franchiseId_medicineId_batchNumber_expiryDate: {
                    franchiseId: line.franchiseId,
                    medicineId: line.medicineId,
                    batchNumber: line.batchNumber,
                    expiryDate: line.expiryDate,
                  },
                },
                create: {
                  franchiseId: line.franchiseId,
                  medicineId: line.medicineId,
                  batchNumber: line.batchNumber,
                  expiryDate: line.expiryDate,
                  quantity: -(line.qtyChange || 0),
                },
                update: {
                  quantity: { decrement: line.qtyChange || 0 },
                },
              });
            }
          }

          await tx.stockLedger.deleteMany({ where: { transactionId: stockTxn.id } });

          await tx.stockLedger.createMany({
            data: (sale.saleDetails || []).map((detail: any) => ({
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

          for (const d of sale.saleDetails || []) {
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

      const sale = await tx.sale.findUnique({ where: { id: existing.saleId }, select: { id: true, franchiseId: true } });
      if (!sale) throw new Error('SALE_NOT_FOUND');

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

      if (statusUpper) {
        patch.status = statusUpper;
        if (statusUpper === 'DISPATCHED') patch.dispatchedAt = now;
      }

      return tx.transport.update({ where: { id: idNum }, data: patch });
    });

    if (!updated) return ApiError('Transport not found', 404);
    return Success(updated);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as Error;
    if (err.message === 'TRANSPORT_ALREADY_DELIVERED') return ApiError('Transport already delivered', 409);
    if (err.message === 'SALE_NOT_FOUND') return ApiError('Sale not found', 404);
    console.error('Update transport error:', e);
    return ApiError('Failed to update transport');
  }
}
