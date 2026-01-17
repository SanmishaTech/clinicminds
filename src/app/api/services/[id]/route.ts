import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest,NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { serviceSchema } from '@/lib/schemas/backend/services';
import { z } from 'zod';


// GET /api/services/:id
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
        unit: true,
        rate: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      };
    
    const record = await prisma.service.findUnique({
      where,
      select,
    });
    
    if (!record) return Error('Service not found', 404);
    return Success(record);
  } catch {
    return Error('Failed to fetch Service');
  }
}

// PATCH /api/services/[id]
export async function PATCH(
  req: NextRequest, context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
     const { id } = await context.params;
    const serviceId = parseInt(id);
    
    if (isNaN(serviceId)) {
      return BadRequest('Invalid service ID');
    }

    const body = await req.json();
    
    const data = serviceSchema.partial().parse(body);

    if (!Object.keys(data).length) {
      return BadRequest('No valid fields to update');
    }

    const existingService = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true }
    });

    if (!existingService) {
      return NotFound('Service not found');
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data,
    });

    return Success(updatedService);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Error updating service:', error);
    return Error('Failed to update service');
  }
}


// DELETE /api/services/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const record = await prisma.service.findUnique({
      where: { id: idNum },
      select: { id: true }
    });
    
    if (!record) return Error('Service not found', 404);
    
    await prisma.service.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Service not found', 404);
    return Error('Failed to delete Service');
  }
}