import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

const packageModel = (prisma as any).package;

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    const record = await packageModel.findUnique({
      where: { id: idNum },
      include: {
        packageDetails: {
          include: {
            service: {
              select: { id: true, name: true, rate: true, description: true },
            },
          },
        },
        packageMedicines: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                rate: true,
                mrp: true,
                brand: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!record) return Error('Package not found', 404);

    const normalized = {
      ...(record as any),
      packageMedicines: ((record as any).packageMedicines || []).map((pm: any) => ({
        ...pm,
        medicine: pm.medicine
          ? {
              ...pm.medicine,
              brand: pm.medicine?.brand?.name ?? null,
            }
          : pm.medicine,
      })),
    };

    return Success(normalized);
  } catch (e) {
    console.error('Error fetching package:', e);
    return Error('Failed to fetch package');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    await packageModel.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Package not found', 404);
    console.error('Error deleting package:', e);
    return Error('Failed to delete package');
  }
}
