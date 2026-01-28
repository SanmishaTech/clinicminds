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

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      for (const item of parsed.data.items) {
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
