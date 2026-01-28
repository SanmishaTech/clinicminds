// src/app/api/labs/[id]/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/labs/[id]
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    const lab = await prisma.lab.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    if (!lab) return Error('Lab not found', 404);
    
    return Success(lab);
  } catch (error) {
    console.error('Error fetching lab:', error);
    return Error('Failed to fetch lab');
  }
}

// DELETE /api/labs/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    // Check if lab is being used by any related records
    // Note: Add relationship checks here if Lab model has foreign key references
    
    await prisma.lab.delete({ where: { id: idNum } });
    
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Lab not found', 404);
    console.error('Delete lab error:', e);
    return Error('Failed to delete lab');
  }
}
