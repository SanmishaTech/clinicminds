import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { ROLES } from '@/config/roles';
import { z } from 'zod';

const refillSchema = z.object({
  items: z
    .array(
      z.object({
        medicineId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        batchNumber: z.string().trim().min(1),
        expiryDate: z.string().trim().min(1),
      })
    )
    .min(1, 'At least one item is required'),
});

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  if (auth.user.role !== ROLES.ADMIN) {
    return ApiError('Forbidden', 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError('Invalid JSON body', 400);
  }

  const parsed = refillSchema.safeParse(body);
  if (!parsed.success) return BadRequest(parsed.error.errors);

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 90);
  for (const item of parsed.data.items) {
    const expiry = new Date(item.expiryDate);
    if (Number.isNaN(expiry.getTime())) {
      return BadRequest('Invalid expiry date');
    }
    if (expiry <= threshold) {
      return ApiError('This batch expiry should be above 90 days', 400);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      for (const item of parsed.data.items) {
        const expiry = new Date(item.expiryDate);
        await (tx as any).adminStockBatchBalance.upsert({
          where: {
            medicineId_batchNumber_expiryDate: {
              medicineId: item.medicineId,
              batchNumber: item.batchNumber,
              expiryDate: expiry,
            },
          },
          create: {
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            expiryDate: expiry,
            quantity: item.quantity,
          },
          update: { quantity: { increment: item.quantity } },
          select: { id: true },
        });

        await (tx as any).adminStockBalance.upsert({
          where: { medicineId: item.medicineId },
          create: { medicineId: item.medicineId, quantity: item.quantity },
          update: { quantity: { increment: item.quantity } },
          select: { id: true },
        });
      }

      return { ok: true } as const;
    });

    return Success(result, 201);
  } catch (e) {
    console.error('Admin stock refill error:', e);
    return ApiError('Failed to refill admin stock');
  }
}
