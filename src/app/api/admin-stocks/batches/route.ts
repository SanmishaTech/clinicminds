import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { ROLES } from '@/config/roles';

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  if (auth.user.role !== ROLES.ADMIN) {
    return Error('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const medicineId = Number(searchParams.get('medicineId'));
  if (!medicineId || Number.isNaN(medicineId)) {
    return Error('medicineId is required', 400);
  }

  try {
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);

    const items = await (prisma as any).adminStockBatchBalance.findMany({
      where: {
        medicineId,
        quantity: { gt: 0 },
        expiryDate: { gt: in90Days },
      },
      orderBy: { expiryDate: 'asc' },
      select: {
        batchNumber: true,
        expiryDate: true,
        quantity: true,
      },
    });

    return Success({
      medicineId,
      items: items.map((item: any) => ({
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: Number(item.quantity ?? 0),
      })),
    });
  } catch (e) {
    console.error('Error fetching admin stock batches:', e);
    return Error('Failed to fetch admin stock batches');
  }
}
