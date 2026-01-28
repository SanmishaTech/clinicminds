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
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid sale ID');
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: idNum },
      include: {
        franchise: {
          select: { id: true, name: true }
        },
        transport: true,
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
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid sale ID');
  try {
    const body = await req.json();
    const data = updateSaleSchema.parse(body) as UpdateSaleInput;
    // Check if sale exists
    const existingSale = await prisma.sale.findUnique({
      where: { id: idNum },
      select: { id: true }
    });
    if (!existingSale) {
      return NotFound('Sale not found');
    }
    // Start a transaction
    const result = await prisma.$transaction(async (tx: any) => {

      const transport = await tx.transport.findUnique({
        where: { saleId: idNum },
        select: { id: true, status: true },
      });
      if (transport && String(transport.status || '').toUpperCase() === 'DELIVERED') {
        throw new globalThis.Error('SALE_DELIVERED');
      }

      const existingSaleForTotals = await tx.sale.findUnique({
        where: { id: idNum },
        select: { discountPercent: true },
      });

      const discountPercent = Math.min(
        100,
        Math.max(0, Number(data.discountPercent ?? existingSaleForTotals?.discountPercent ?? 0) || 0)
      );

      const shouldRecalcTotal = data.saleDetails !== undefined || data.discountPercent !== undefined;

      const subtotal = await (async () => {
        if (data.saleDetails !== undefined) {
          return (data.saleDetails || []).reduce((sum, d) => {
            const qty = Number(d.quantity ?? 0) || 0;
            const rate = Number(d.rate ?? 0) || 0;
            return sum + qty * rate;
          }, 0);
        }

        const existingDetails = await tx.saleDetail.findMany({
          where: { saleId: idNum },
          select: { quantity: true, rate: true },
        });
        return existingDetails.reduce(
          (sum: number, d: any) => sum + (Number(d.quantity) || 0) * (Number(d.rate) || 0),
          0
        );
      })();

      const totalAmount = shouldRecalcTotal
        ? Math.max(0, subtotal - subtotal * (discountPercent / 100))
        : undefined;

      const updateData: any = {};
      if (data.invoiceDate !== undefined) updateData.invoiceDate = new Date(data.invoiceDate);
      if (data.franchiseId !== undefined) updateData.franchiseId = data.franchiseId;
      if (data.discountPercent !== undefined) updateData.discountPercent = discountPercent;
      if (totalAmount !== undefined) updateData.totalAmount = totalAmount;

      const sale = await tx.sale.update({
        where: { id: idNum },
        data: updateData,
      });

      if (data.saleDetails && data.saleDetails.length > 0) {
        await tx.saleDetail.deleteMany({ where: { saleId: idNum } });
        await tx.saleDetail.createMany({
          data: data.saleDetails.map((detail) => {
            const quantity = Number(detail.quantity ?? 0) || 0;
            const rate = Number(detail.rate ?? 0) || 0;
            return {
              saleId: idNum,
              medicineId: detail.medicineId!,
              batchNumber: detail.batchNumber,
              expiryDate: new Date(detail.expiryDate),
              quantity,
              rate,
              amount: quantity * rate,
            };
          }),
        });
      }

      if (!transport) {
        await tx.transport.create({
          data: {
            saleId: idNum,
            franchiseId: sale.franchiseId,
            status: 'PENDING',
          },
          select: { id: true },
        });
      } else if (data.franchiseId !== undefined) {
        await tx.transport.update({
          where: { saleId: idNum },
          data: { franchiseId: sale.franchiseId },
          select: { id: true },
        });
      }

      return tx.sale.findUnique({
        where: { id: idNum },
        include: {
          transport: true,
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
    const err = error as { message?: string };
    if (err?.message === 'SALE_DELIVERED') {
      return Error('Sale cannot be updated after it is delivered', 409);
    }
    console.error('Error updating sale:', error);
    return Error('Failed to update sale');
  }
}

// DELETE /api/sales/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid sale ID');
  try {
    const deleted = await prisma.$transaction(async (tx: any) => {
      const existingSale = await tx.sale.findUnique({
        where: { id: idNum },
        select: { id: true },
      });
      if (!existingSale) {
        return null;
      }

      const stockTxn = await tx.stockTransaction.findUnique({
        where: { saleId: idNum },
        select: { id: true },
      });

      if (stockTxn) {
        const ledgerLines = await tx.stockLedger.findMany({
          where: { transactionId: stockTxn.id },
          select: { franchiseId: true, medicineId: true, batchNumber: true, expiryDate: true, qtyChange: true },
        });

        for (const line of ledgerLines) {
          await tx.stockBalance.upsert({
            where: {
              franchiseId_medicineId: {
                franchiseId: line.franchiseId,
                medicineId: line.medicineId,
              },
            },
            create: {
              franchiseId: line.franchiseId,
              medicineId: line.medicineId,
              quantity: -line.qtyChange,
            },
            update: {
              quantity: { decrement: line.qtyChange },
            },
          });

          if (line.batchNumber && line.expiryDate) {
            await tx.stockBatchBalance.upsert({
              where: {
                franchiseId_medicineId_batchNumber_expiryDate: {
                  franchiseId: line.franchiseId,
                  medicineId: line.medicineId,
                  batchNumber: line.batchNumber,
                  expiryDate: line.expiryDate,
                },
              },
              create: {
                franchiseId: line.franchiseId,
                medicineId: line.medicineId,
                batchNumber: line.batchNumber,
                expiryDate: line.expiryDate,
                quantity: -line.qtyChange,
              },
              update: {
                quantity: { decrement: line.qtyChange },
              },
            });
          }
        }
      }

      await tx.sale.delete({ where: { id: idNum } });
      return { id: idNum };
    });

    if (!deleted) return NotFound('Sale not found');
    return Success(deleted);
  } catch (error) {
    console.error('Error deleting sale:', error);
    return Error('Failed to delete sale');
  }
}