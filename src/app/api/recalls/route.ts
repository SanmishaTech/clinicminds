import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { ROLES } from '@/config/roles';

type RecallListItem = {
  id: number;
  recalledAt: string;
  franchiseId: number;
  franchiseName: string;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  txnNo: string;
};

// GET /api/recalls (Admin only)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  if (auth.user.role !== ROLES.ADMIN) {
    return Error('Unauthorized role', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const search = (searchParams.get('search') || '').trim();
  const sort = (searchParams.get('sort') || 'recalledAt').trim();
  const order = (searchParams.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  const where: any = {};
  if (search) {
    where.OR = [
      { franchise: { name: { contains: search, mode: 'insensitive' } } },
      { medicine: { name: { contains: search, mode: 'insensitive' } } },
      { batchNumber: { contains: search, mode: 'insensitive' } },
      { stockTransaction: { txnNo: { contains: search, mode: 'insensitive' } } },
    ];
  }

  try {
    const model = (prisma as any).stockRecall;
    const sortable = new Set([
      'recalledAt',
      'expiryDate',
      'quantity',
      'batchNumber',
      'franchiseName',
      'medicineName',
      'txnNo',
    ]);

    const sortKey = sortable.has(sort) ? sort : 'recalledAt';

    const orderBy: any = (() => {
      switch (sortKey) {
        case 'expiryDate':
          return { expiryDate: order };
        case 'quantity':
          return { quantity: order };
        case 'batchNumber':
          return { batchNumber: order };
        case 'franchiseName':
          return { franchise: { name: order } };
        case 'medicineName':
          return { medicine: { name: order } };
        case 'txnNo':
          return { stockTransaction: { txnNo: order } };
        case 'recalledAt':
        default:
          return { recalledAt: order };
      }
    })();

    const result = await paginate<{ id: true; recalledAt: true; batchNumber: true; expiryDate: true; quantity: true; franchiseId: true; medicineId: true; franchise: any; medicine: any; stockTransaction: any }, any, any>({
      model,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        recalledAt: true,
        franchiseId: true,
        medicineId: true,
        batchNumber: true,
        expiryDate: true,
        quantity: true,
        franchise: { select: { name: true } },
        medicine: { select: { name: true } },
        stockTransaction: { select: { txnNo: true } },
      },
    });

    const data: RecallListItem[] = (result.data as any[]).map((r) => ({
      id: r.id,
      recalledAt: r.recalledAt ? new Date(r.recalledAt).toISOString() : '',
      franchiseId: r.franchiseId,
      franchiseName: r.franchise?.name || `Franchise ${r.franchiseId}`,
      medicineId: r.medicineId,
      medicineName: r.medicine?.name || `Medicine ${r.medicineId}`,
      batchNumber: String(r.batchNumber ?? ''),
      expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString() : '',
      quantity: Number(r.quantity ?? 0),
      txnNo: r.stockTransaction?.txnNo || '',
    }));

    return Success({ ...result, data });
  } catch (e) {
    console.error('Error fetching recalls:', e);
    return Error('Failed to fetch recalls');
  }
}
