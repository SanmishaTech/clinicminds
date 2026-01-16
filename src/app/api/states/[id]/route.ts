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
    const state = await prisma.state.findUnique({
      where: { id: idNum },
      select: { id: true, state: true },
    });
    if (!state) return Error('State not found', 404);
    return Success(state);
  } catch (e: unknown) {
    console.error('Failed to fetch state:', e);
    return Error('Failed to fetch state');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    await prisma.state.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    console.error('Failed to delete state:', e);
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('State not found', 404);
    if (err?.code === 'P2021') return Error('Database not migrated for states. Run Prisma migrate.', 500);
    return Error('Failed to delete state');
  }
}
