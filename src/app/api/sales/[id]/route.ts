// src/app/api/sales/[id]/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { updateSaleSchema, type UpdateSaleInput } from '@/lib/schemas/backend/sales';
import { z } from 'zod';
// GET /api/sales/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;
  const id = parseInt(params.id);
  if (isNaN(id)) return BadRequest('Invalid sale ID');
  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        franchise: {
          select: { id: true, name: true }
        },
        saleDetails: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                brand: true
              }
            }
          }
        }
      }
    });
    if (!sale) {
      return NotFound('Sale not found');
    }
    return Success(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    return Error('Failed to fetch sale');
  }
}
// PATCH /api/sales/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;
  const id = parseInt(params.id);
  if (isNaN(id)) return BadRequest('Invalid sale ID');
  try {
    const body = await req.json();
    const data = updateSaleSchema.parse(body) as UpdateSaleInput;
    // Check if sale exists
    const existingSale = await prisma.sale.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!existingSale) {
      return NotFound('Sale not found');
    }
    // Start a transaction
    const result = await prisma.$transaction(async (prisma) => {
      const updateData: any = {};
      if (data.invoiceDate !== undefined) updateData.invoiceDate = new Date(data.invoiceDate);
      if (data.franchiseId !== undefined) updateData.franchiseId = data.franchiseId;
      if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
      // Update sale
      const sale = await prisma.sale.update({
        where: { id },
        data: updateData
      });
      // Update sale details if provided
      if (data.saleDetails && data.saleDetails.length > 0) {
        // Delete existing sale details and create new ones
        await prisma.saleDetail.deleteMany({
          where: { saleId: id }
        });
        await prisma.saleDetail.createMany({
          data: data.saleDetails.map(detail => ({
            saleId: id,
            medicineId: detail.medicineId!,
            quantity: detail.quantity!,
            rate: detail.rate!,
            amount: detail.amount!
          }))
        });
      }
      // Return the updated sale with details
      return prisma.sale.findUnique({
        where: { id },
        include: {
          saleDetails: {
            include: {
              medicine: {
                select: {
                  id: true,
                  name: true,
                  brand: true
                }
              }
            }
          }
        }
      });
    });
    return Success(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Error updating sale:', error);
    return Error('Failed to update sale');
  }
}
// DELETE /api/sales/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;
  const id = parseInt(params.id);
  if (isNaN(id)) return BadRequest('Invalid sale ID');
  try {
    // Check if sale exists
    const existingSale = await prisma.sale.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!existingSale) {
      return NotFound('Sale not found');
    }
    // The onDelete: Cascade in the schema will handle deleting related saleDetails
    await prisma.sale.delete({
      where: { id }
    });
    return Success({ id });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return Error('Failed to delete sale');
  }
}