// src/app/api/brands/[id]/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { brandUpdateSchema } from '@/lib/schemas/backend/brands';
import { z } from 'zod';

// GET /api/brands/[id]
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid ID format');
  
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
    
    if (!brand) {
      return NotFound('Brand not found');
    }
    
    return Success(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    return Error('Failed to fetch brand');
  }
}

// PATCH /api/brands/[id]
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid ID format');
  
  try {
    const body = await req.json();
    const data = brandUpdateSchema.parse(body);
    
    const brand = await prisma.brand.update({
      where: { id: idNum },
      data
    });
    
    return Success(brand);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') {
      return NotFound('Brand not found');
    }
    console.error('Update brand error:', error);
    return Error('Failed to update brand');
  }
}

// DELETE /api/brands/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid ID format');
  
  try {
    // Check if brand is being used by any medicines
    const medicineCount = await prisma.medicine.count({
      where: { brandId: idNum }
    });
    
    if (medicineCount > 0) {
      return BadRequest(`Cannot delete brand: ${medicineCount} medicine(s) are associated with this brand`);
    }
    
    await prisma.brand.delete({
      where: { id: idNum }
    });
    
    return Success({ message: 'Brand deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return NotFound('Brand not found');
    }
    console.error('Delete brand error:', error);
    return Error('Failed to delete brand');
  }
}