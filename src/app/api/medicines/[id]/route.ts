import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest,NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { medicineSchema } from '@/lib/schemas/backend/medicines';
import { z } from 'zod';

function toDecimal2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function computeInclusiveRate(baseRate: number, gstPercent: number) {
  const gst = Number.isFinite(gstPercent) ? gstPercent : 0;
  const base = Number.isFinite(baseRate) ? baseRate : 0;
  const franchiseRate = base + (base * gst) / 100;
  return {
    baseRate: toDecimal2(base),
    gstPercent: toDecimal2(gst),
    franchiseRate: toDecimal2(franchiseRate),
  };
}

// GET /api/medicines/:id
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
        brandId: true,
        brand: {
          select: {
            name: true,
          }
        },
        rate: true,
        baseRate: true,
        gstPercent: true,
        franchiseRate: true,
        mrp: true,
        createdAt: true,
        updatedAt: true,
      };
    
    const record = await prisma.medicine.findUnique({
      where,
      select,
    });
    
    if (!record) return Error('Medicine not found', 404);

    return Success({
      ...(record as any),
      brand: (record as any).brand?.name ?? null,
    });
  } catch {
    return Error('Failed to fetch Medicine');
  }
}

// PATCH /api/medicines/[id]
export async function PATCH(
  req: NextRequest, context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
     const { id } = await context.params;
    const medicineId = parseInt(id);
    
    if (isNaN(medicineId)) {
      return BadRequest('Invalid medicine ID');
    }

    const body = await req.json();
    
    const data = medicineSchema.partial().parse(body);

    if (!Object.keys(data).length) {
      return BadRequest('No valid fields to update');
    }

    const existingMedicine = await prisma.medicine.findUnique({
      where: { id: medicineId },
      select: { id: true, rate: true, gstPercent: true }
    });

    if (!existingMedicine) {
      return NotFound('Medicine not found');
    }

    const updateData: Record<string, unknown> = { ...data };

    const hasRate = Object.prototype.hasOwnProperty.call(data, 'rate');
    const hasGst = Object.prototype.hasOwnProperty.call(data, 'gstPercent');
    if (hasRate || hasGst) {
      const existingBase = Number((existingMedicine as any).rate ?? 0);
      const existingGst = Number((existingMedicine as any).gstPercent ?? 0);

      const baseForCalc = hasRate ? Number((data as any).rate) : existingBase;
      const gstForCalc = hasGst ? Number((data as any).gstPercent) : existingGst;
      const computed = computeInclusiveRate(baseForCalc, gstForCalc);
      updateData.rate = computed.baseRate;
      updateData.baseRate = computed.baseRate;
      updateData.gstPercent = computed.gstPercent;
      updateData.franchiseRate = computed.franchiseRate;
    }

    const updatedMedicine = await prisma.medicine.update({
      where: { id: medicineId },
      data: updateData as any,
    });

    return Success(updatedMedicine);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    const err = error as { code?: string };
    if (err?.code === 'P2002') return Error('Medicine name already exists', 409);
    console.error('Error updating medicine:', error);
    return Error('Failed to update medicine');
  }
}


// DELETE /api/medicines/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const record = await prisma.medicine.findUnique({
      where: { id: idNum },
      select: { id: true }
    });
    
    if (!record) return Error('Medicine not found', 404);
    
    await prisma.medicine.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Medicine not found', 404);
    return Error('Failed to delete Medicine');
  }
}