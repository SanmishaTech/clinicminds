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
    const team = await prisma.team.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        name: true,
        joiningDate: true,
        leavingDate: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        userMobile: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: true,
          },
        },
      },
    });

    if (!team) return Error('Team not found', 404);
    return Success(team);
  } catch {
    return Error('Failed to fetch team');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    const team = await prisma.team.findUnique({ where: { id: idNum }, select: { id: true, userId: true } });
    if (!team) return Error('Team not found', 404);

    await prisma.user.delete({ where: { id: team.userId } });

    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Team not found', 404);
    return Error('Failed to delete team');
  }
}
