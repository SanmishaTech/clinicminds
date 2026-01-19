import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/rooms/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
   
    let where: any = { id: idNum };
      const select = {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      };
    
    const record = await prisma.room.findUnique({
      where,
      select,
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

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const record = await prisma.room.findUnique({
      where: { id: idNum },
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