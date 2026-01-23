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
    const result = await prisma.$transaction(async (tx: any) => {

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
        select: { franchiseId: true, medicineId: true, batchNumber: true, expiryDate: true, qtyChange: true },
      });

      // Update sale details if provided
      if (data.saleDetails && data.saleDetails.length > 0) {

        const oldQtyByMedicineId = new Map<number, number>();
        const oldQtyByBatchKey = new Map<
          string,
          { franchiseId: number; medicineId: number; batchNumber: string; expiryDate: Date; qty: number }
        >();
        for (const line of existingLedgerLines) {
          oldQtyByMedicineId.set(
            line.medicineId,
            (oldQtyByMedicineId.get(line.medicineId) ?? 0) + (line.qtyChange ?? 0)
          );

          if (line.batchNumber && line.expiryDate) {
            const key = `${line.franchiseId}:${line.medicineId}:${line.batchNumber}:${line.expiryDate.toISOString()}`;
            const existing = oldQtyByBatchKey.get(key);
            if (existing) {
              existing.qty += line.qtyChange ?? 0;
            } else {
              oldQtyByBatchKey.set(key, {
                franchiseId: line.franchiseId,
                medicineId: line.medicineId,
                batchNumber: line.batchNumber,
                expiryDate: new Date(line.expiryDate),
                qty: line.qtyChange ?? 0,
              });
            }
          }
        }

        for (const [medicineId, qty] of oldQtyByMedicineId.entries()) {
          if (!qty) continue;
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
              quantity: -qty,
            },
            update: {
              quantity: { decrement: qty },
            },
          });
        }

        for (const entry of oldQtyByBatchKey.values()) {
          if (!entry.qty) continue;
          await tx.stockBatchBalance.upsert({
            where: {
              franchiseId_medicineId_batchNumber_expiryDate: {
                franchiseId: entry.franchiseId,
                medicineId: entry.medicineId,
                batchNumber: entry.batchNumber,
                expiryDate: entry.expiryDate,
              },
            },
            create: {
              franchiseId: entry.franchiseId,
              medicineId: entry.medicineId,
              batchNumber: entry.batchNumber,
              expiryDate: entry.expiryDate,
              quantity: -entry.qty,
            },
            update: {
              quantity: { decrement: entry.qty },
            },
          });
        }

        // Delete existing sale details and create new ones
        await tx.saleDetail.deleteMany({
          where: { saleId: idNum }
        });
        await tx.saleDetail.createMany({
          data: data.saleDetails.map(detail => ({
            saleId: idNum,
            medicineId: detail.medicineId!,
            batchNumber: detail.batchNumber,
            expiryDate: new Date(detail.expiryDate),
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
            batchNumber: detail.batchNumber,
            expiryDate: new Date(detail.expiryDate),
            qtyChange: detail.quantity!,
            rate: detail.rate!,
            amount: detail.amount!,
          })),
        });

        const qtyByMedicineId = new Map<number, number>();
        const qtyByBatchKey = new Map<
          string,
          { franchiseId: number; medicineId: number; batchNumber: string; expiryDate: Date; qty: number }
        >();
        for (const d of data.saleDetails) {
          if (d.medicineId == null || d.quantity == null) continue;
          qtyByMedicineId.set(d.medicineId, (qtyByMedicineId.get(d.medicineId) ?? 0) + d.quantity);

          const key = `${sale.franchiseId}:${d.medicineId}:${d.batchNumber}:${d.expiryDate}`;
          const existing = qtyByBatchKey.get(key);
          if (existing) {
            existing.qty += d.quantity;
          } else {
            qtyByBatchKey.set(key, {
              franchiseId: sale.franchiseId,
              medicineId: d.medicineId,
              batchNumber: d.batchNumber,
              expiryDate: new Date(d.expiryDate),
              qty: d.quantity,
            });
          }
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

        for (const entry of qtyByBatchKey.values()) {
          await tx.stockBatchBalance.upsert({
            where: {
              franchiseId_medicineId_batchNumber_expiryDate: {
                franchiseId: entry.franchiseId,
                medicineId: entry.medicineId,
                batchNumber: entry.batchNumber,
                expiryDate: entry.expiryDate,
              },
            },
            create: {
              franchiseId: entry.franchiseId,
              medicineId: entry.medicineId,
              batchNumber: entry.batchNumber,
              expiryDate: entry.expiryDate,
              quantity: entry.qty,
            },
            update: {
              quantity: { increment: entry.qty },
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

          if (line.batchNumber && line.expiryDate) {
            await tx.stockBatchBalance.upsert({
              where: {
                franchiseId_medicineId_batchNumber_expiryDate: {
                  franchiseId: sale.franchiseId,
                  medicineId: line.medicineId,
                  batchNumber: line.batchNumber,
                  expiryDate: line.expiryDate,
                },
              },
              create: {
                franchiseId: sale.franchiseId,
                medicineId: line.medicineId,
                batchNumber: line.batchNumber,
                expiryDate: line.expiryDate,
                quantity: line.qtyChange,
              },
              update: {
                quantity: { increment: line.qtyChange },
              },
            });
          }
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