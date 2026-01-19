// src/app/api/brands/[id]/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/brands/[id]
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    if (!brand) return Error('Brand not found', 404);
    
    return Success(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    return Error('Failed to fetch brand');
  }
}

// DELETE /api/brands/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    // Check if brand is being used by any medicines
    const medicineCount = await prisma.medicine.count({ where: { brandId: idNum } });
    
    if (medicineCount > 0) {
      return Error(`Cannot delete brand: ${medicineCount} medicine(s) are associated with this brand`, 400);
    }
    
    await prisma.brand.delete({ where: { id: idNum } });
    
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Brand not found', 404);
    console.error('Delete brand error:', e);
    return Error('Failed to delete brand');
  }
}