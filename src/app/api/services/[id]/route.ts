import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest,NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { serviceSchema } from '@/lib/schemas/backend/services';
import { z } from 'zod';

function toDecimal2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function computeInclusiveRate(baseRate: number, gstPercent: number) {
  const gst = Number.isFinite(gstPercent) ? gstPercent : 0;
  const base = Number.isFinite(baseRate) ? baseRate : 0;
  const rate = base + (base * gst) / 100;
  return {
    baseRate: toDecimal2(base),
    gstPercent: toDecimal2(gst),
    rate: toDecimal2(rate),
  };
}

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
        rate: true,
        baseRate: true,
        gstPercent: true,
        isProcedure: true,
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
      select: { id: true, rate: true, baseRate: true, gstPercent: true }
    });

    if (!existingService) {
      return NotFound('Service not found');
    }

    const updateData: Record<string, unknown> = { ...data };
    if (Object.prototype.hasOwnProperty.call(data, 'isProcedure')) {
      updateData.isProcedure = Boolean((data as any).isProcedure);
    }

    const hasRate = Object.prototype.hasOwnProperty.call(data, 'rate');
    const hasGst = Object.prototype.hasOwnProperty.call(data, 'gstPercent');
    if (hasRate || hasGst) {
      const existingRate = Number(existingService.rate as any);
      const existingBase = Number(existingService.baseRate as any);
      const existingGst = Number(existingService.gstPercent as any);
      const baseForCalc = hasRate ? Number((data as any).rate) : (existingBase === 0 && existingRate !== 0 && existingGst === 0 ? existingRate : existingBase);
      const gstForCalc = hasGst ? Number((data as any).gstPercent) : existingGst;
      const computed = computeInclusiveRate(baseForCalc, gstForCalc);
      updateData.rate = computed.rate;
      updateData.baseRate = computed.baseRate;
      updateData.gstPercent = computed.gstPercent;
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: updateData as any,
    });
    

    return Success(updatedService);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    const err = error as { code?: string };
    if (err?.code === 'P2002') return Error('Service name already exists', 409);
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