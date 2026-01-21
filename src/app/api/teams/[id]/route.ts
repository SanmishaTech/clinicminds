import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    const team = await prisma.team.findUnique({
      where: { id: idNum, franchiseId: franchiseId },
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

  // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return Error("Current user is not associated with any franchise", 400);
  }

  try {
    const team = await prisma.team.findUnique({ 
      where: { id: idNum, franchiseId }, 
      select: { id: true, userId: true } 
    });
    if (!team) return Error('Team not found', 404);

    await prisma.user.delete({ where: { id: team.userId } });

    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Team not found', 404);
    return Error('Failed to delete team');
  }
}
