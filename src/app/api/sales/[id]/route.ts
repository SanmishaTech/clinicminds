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
    const result = await prisma.$transaction(async (tx) => {

      const updateData: any = {};
      if (data.invoiceDate !== undefined) updateData.invoiceDate = new Date(data.invoiceDate);
      if (data.franchiseId !== undefined) updateData.franchiseId = data.franchiseId;
      if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
      // Update sale
      const sale = await tx.sale.update({
        where: { id: idNum },
        data: updateData
      });

      // Ensure stock transaction exists for this sale and keep header in sync
      const stockTxn = await tx.stockTransaction.upsert({
        where: { saleId: idNum },
        create: {
          txnType: 'SALE_TO_FRANCHISE',
          txnNo: '',
          txnDate: sale.invoiceDate,
          franchiseId: sale.franchiseId,
          createdByUserId: auth.user.id,
          saleId: idNum,
          notes: null,
        },
        update: {
          txnDate: sale.invoiceDate,
          franchiseId: sale.franchiseId,
        },
        select: { id: true },
      });

      const existingLedgerLines = await tx.stockLedger.findMany({
        where: { transactionId: stockTxn.id },
        select: { franchiseId: true, medicineId: true, qtyChange: true },
      });

      // Update sale details if provided
      if (data.saleDetails && data.saleDetails.length > 0) {

        // Delete existing sale details and create new ones
        await tx.saleDetail.deleteMany({
          where: { saleId: idNum }
        });
        await tx.saleDetail.createMany({
          data: data.saleDetails.map(detail => ({
            saleId: idNum,
            medicineId: detail.medicineId!,
            quantity: detail.quantity!,
            rate: detail.rate!,
            amount: detail.amount!
          }))
        });

        // Replace ledger lines to match the updated sale details
        await tx.stockLedger.deleteMany({
          where: { transactionId: stockTxn.id },
        });
        await tx.stockLedger.createMany({
          data: data.saleDetails.map((detail) => ({
            transactionId: stockTxn.id,
            franchiseId: sale.franchiseId,
            medicineId: detail.medicineId!,
            qtyChange: detail.quantity!,
            rate: detail.rate!,
            amount: detail.amount!,
          })),
        });

        for (const line of existingLedgerLines) {
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
        }

        const qtyByMedicineId = new Map<number, number>();
        for (const d of data.saleDetails) {
          if (d.medicineId == null || d.quantity == null) continue;
          qtyByMedicineId.set(d.medicineId, (qtyByMedicineId.get(d.medicineId) ?? 0) + d.quantity);
        }
        for (const [medicineId, qty] of qtyByMedicineId.entries()) {
          await tx.stockBalance.upsert({
            where: {
              franchiseId_medicineId: {
                franchiseId: sale.franchiseId,
                medicineId,
              },
            },
            create: {
              franchiseId: sale.franchiseId,
              medicineId,
              quantity: qty,
            },
            update: {
              quantity: { increment: qty },
            },
          });
        }
      } else if (data.franchiseId !== undefined) {
        // Franchise changed but details not re-sent: keep existing ledger lines but move them to the new franchise
        await tx.stockLedger.updateMany({
          where: { transactionId: stockTxn.id },
          data: { franchiseId: sale.franchiseId },
        });

        for (const line of existingLedgerLines) {
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

          await tx.stockBalance.upsert({
            where: {
              franchiseId_medicineId: {
                franchiseId: sale.franchiseId,
                medicineId: line.medicineId,
              },
            },
            create: {
              franchiseId: sale.franchiseId,
              medicineId: line.medicineId,
              quantity: line.qtyChange,
            },
            update: {
              quantity: { increment: line.qtyChange },
            },
          });
        }
      }

      // Return the updated sale with details
      return tx.sale.findUnique({
        where: { id: idNum },
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
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid sale ID');
  try {
    const deleted = await prisma.$transaction(async (tx) => {
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
          select: { franchiseId: true, medicineId: true, qtyChange: true },
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