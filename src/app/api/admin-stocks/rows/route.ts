import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { ROLES } from '@/config/roles';

type AdminStockRow = {
  medicineId: number;
  medicineName: string;
  brandName: string | null;
  rate: string;
  stock: number;
};

type AdminStocksRowsResponse = {
  data: AdminStockRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  if (auth.user.role !== ROLES.ADMIN) {
    return Error('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const sort = (searchParams.get('sort') || 'medicineName').trim();
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

  try {
    const model = (prisma as any).adminStockBalance;

    const where: any = {};
    if (search) {
      where.OR = [
        { medicine: { name: { contains: search } } },
        { medicine: { brand: { name: { contains: search } } } },
      ];
      const searchNumber = Number(search);
      if (!Number.isNaN(searchNumber)) {
        where.OR.push({ medicineId: searchNumber });
      }
    }

    const sortable = new Set(['medicineName', 'brandName', 'rate', 'stock', 'medicineId']);
    const sortKey = sortable.has(sort) ? sort : 'medicineName';

    const orderBy: any = (() => {
      switch (sortKey) {
        case 'medicineId':
          return { medicineId: order };
        case 'rate':
          return { medicine: { rate: order } };
        case 'stock':
          return { quantity: order };
        case 'brandName':
          return { medicine: { brand: { name: order } } };
        case 'medicineName':
        default:
          return { medicine: { name: order } };
      }
    })();

    const total = await model.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const skip = (page - 1) * perPage;

    const rows = await model.findMany({
      where,
      orderBy,
      skip,
      take: perPage,
      select: {
        medicineId: true,
        quantity: true,
        medicine: {
          select: {
            name: true,
            rate: true,
            brand: { select: { name: true } },
          },
        },
      },
    });

    const data: AdminStockRow[] = rows.map((r: any) => ({
      medicineId: r.medicineId,
      medicineName: r.medicine?.name || `Medicine ${r.medicineId}`,
      brandName: r.medicine?.brand?.name ?? null,
      rate: String(r.medicine?.rate ?? 0),
      stock: Number(r.quantity ?? 0),
    }));

    const response: AdminStocksRowsResponse = { data, page, perPage, total, totalPages };
    return Success(response);
  } catch (e) {
    console.error('Error fetching admin stock rows:', e);
    return Error('Failed to fetch admin stock rows');
  }
}
