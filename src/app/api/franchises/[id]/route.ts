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
    const franchise = await prisma.franchise.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        contactNo: true,
        contactEmail: true,
        userMobile: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!franchise) return Error('Franchise not found', 404);
    return Success(franchise);
  } catch {
    return Error('Failed to fetch franchise');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    const franchise = await prisma.franchise.findUnique({ where: { id: idNum }, select: { id: true, userId: true } });
    if (!franchise) return Error('Franchise not found', 404);

    await prisma.user.delete({ where: { id: franchise.userId } });

    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Franchise not found', 404);
    return Error('Failed to delete franchise');
  }
}
