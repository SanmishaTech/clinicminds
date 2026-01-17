import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    const city = await prisma.city.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        city: true,
        stateId: true,
        createdAt: true,
        state: { select: { id: true, state: true } },
      },
    });
    if (!city) return Error('City not found', 404);
    return Success(city);
  } catch (e: unknown) {
    console.error('Failed to fetch city:', e);
    return Error('Failed to fetch city');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    await prisma.city.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    console.error('Failed to delete city:', e);
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('City not found', 404);
    if (err?.code === 'P2003') return Error('Cannot delete city because it is in use', 409);
    if (err?.code === 'P2021') return Error('Database not migrated for cities. Run Prisma migrate.', 500);
    return Error('Failed to delete city');
  }
}
