import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';

const recallStockSchema = z.object({
  franchiseId: z.number().int().positive(),
  medicineId: z.number().int().positive(),
  batchNumber: z.string().trim().min(1),
  expiryDate: z.string().min(1),
  quantity: z.number().int().positive(),
});

// POST /api/stocks/recall
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error('Invalid JSON body', 400);
  }

  const parsed = recallStockSchema.safeParse(body);
  if (!parsed.success) return BadRequest(parsed.error.errors);

  const { franchiseId, medicineId, batchNumber, expiryDate, quantity } = parsed.data;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return Error('Invalid expiryDate', 400);

  const now = new Date();
  const in45Days = new Date(now);
  in45Days.setDate(in45Days.getDate() + 45);
  if (expiry > in45Days) return Error('Recall is only allowed for expiring stock (within 45 days)', 400);

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const currentBatch = await tx.stockBatchBalance.findUnique({
        where: {
          franchiseId_medicineId_batchNumber_expiryDate: {
            franchiseId,
            medicineId,
            batchNumber,
            expiryDate: expiry,
          },
        },
        select: { quantity: true },
      });

      if (!currentBatch) return { error: 'NOT_FOUND' } as const;
      if (Number(currentBatch.quantity) < quantity) return { error: 'INSUFFICIENT' } as const;

      const medicine = await tx.medicine.findUnique({
        where: { id: medicineId },
        select: { rate: true },
      });
      const rate = Number(medicine?.rate ?? 0);

      const stockTxn = await tx.stockTransaction.create({
        data: {
          txnType: 'RECALL_FROM_FRANCHISE',
          txnNo: '',
          txnDate: new Date(),
          franchiseId,
          createdByUserId: auth.user.id,
          notes: null,
        },
        select: { id: true },
      });

      await tx.stockLedger.create({
        data: {
          transactionId: stockTxn.id,
          franchiseId,
          medicineId,
          batchNumber,
          expiryDate: expiry,
          qtyChange: -quantity,
          rate,
          amount: rate * quantity,
        },
        select: { id: true },
      });

      await (tx as any).stockRecall.create({
        data: {
          stockTransactionId: stockTxn.id,
          franchiseId,
          medicineId,
          batchNumber,
          expiryDate: expiry,
          quantity,
          createdByUserId: auth.user.id,
        },
        select: { id: true },
      });

      await tx.stockBalance.upsert({
        where: {
          franchiseId_medicineId: {
            franchiseId,
            medicineId,
          },
        },
        create: {
          franchiseId,
          medicineId,
          quantity: -quantity,
        },
        update: {
          quantity: { decrement: quantity },
        },
        select: { id: true },
      });

      const updatedBatch = await tx.stockBatchBalance.update({
        where: {
          franchiseId_medicineId_batchNumber_expiryDate: {
            franchiseId,
            medicineId,
            batchNumber,
            expiryDate: expiry,
          },
        },
        data: {
          quantity: { decrement: quantity },
        },
        select: { quantity: true },
      });

      return { ok: true, remainingBatchQty: updatedBatch.quantity } as const;
    });

    if ((result as any).error === 'NOT_FOUND') return Error('Stock batch not found', 404);
    if ((result as any).error === 'INSUFFICIENT') return Error('Insufficient stock to recall', 409);

    return Success(result);
  } catch (e) {
    console.error('Recall stock error:', e);
    return Error('Failed to recall stock');
  }
}
