import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/rooms/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      franchise: {
        select: { id: true }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  if (!currentUser.franchise) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    const record = await prisma.room.findUnique({
      where: { id: idNum, franchiseId: currentUser.franchise.id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!record) return Error('Room not found', 404);
    return Success(record);
  } catch {
    return Error('Failed to fetch Room');
  }
}

// DELETE /api/rooms/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      franchise: {
        select: { id: true }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  if (!currentUser.franchise) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    const record = await prisma.room.findUnique({
      where: { id: idNum, franchiseId: currentUser.franchise.id },
      select: { id: true }
    });
    
    if (!record) return Error('Room not found', 404);
    
    await prisma.room.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Room not found', 404);
    return Error('Failed to delete Room');
  }
}