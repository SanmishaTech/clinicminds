import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';

function throwHttp(message: string, status: number): never {
  const err = new globalThis.Error(message) as globalThis.Error & { status?: number };
  err.status = status;
  throw err;
}

const medicineBillDetailSchema = z.object({
  medicineId: z.number().int().positive(),
  qty: z.number().int().positive(),
  mrp: z.number().positive(),
  amount: z.number().positive(),
});

const createMedicineBillSchema = z.object({
  patientId: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  totalAmount: z.number().positive(),
  medicineBillDetails: z.array(medicineBillDetailSchema).min(1),
});

const updateMedicineBillSchema = createMedicineBillSchema.partial().extend({
  medicineBillDetails: z.array(medicineBillDetailSchema.partial()).optional(),
});

// GET /api/medicine-bills
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const search = (searchParams.get('search') || '').trim();
  const sort = (searchParams.get('sort') || 'billDate').trim();
  const order = (searchParams.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  try {
     // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }

    const where: any = {};
    
    // Non-admin users can only see their franchise bills
    if (auth.user.role !== 'Admin') {
      where.franchiseId = franchiseId;
    }

    if (search) {
      where.OR = [
        { billNumber: { contains: search } },
        { franchise: { name: { contains: search } } },
        { patient: { firstName: { contains: search }, 
                     middleName: { contains: search }, 
                     lastName: { contains: search } } },
      ];
    }

    const model = prisma.medicineBill;
    const sortable = new Set([
      'billDate',
      'totalAmount',
      'billNumber',
      'franchiseName',
      'patientName',
    ]);

    const sortKey = sortable.has(sort) ? sort : 'billDate';

    const orderBy: any = (() => {
      switch (sortKey) {
        case 'totalAmount':
          return { totalAmount: order };
        case 'billNumber':
          return { billNumber: order };
        case 'franchiseName':
          return { franchise: { name: order } };
        case 'patientName':
          return { patient: { firstName: order, middleName: order, lastName: order } };
        case 'billDate':
        default:
          return { billDate: order };
      }
    })();

    const result = await (prisma as any).$transaction([
      model.count({ where }),
      model.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          totalAmount: true,
          discountPercent: true,
          franchise: { select: { name: true } },
          patient: { select: { firstName: true, middleName: true, lastName: true } },
          medicineDetails: {
            select: {
              id: true,
              medicine: { 
                select: { 
                  name: true,
                  brand: { select: { name: true } }
                } 
              },
              qty: true,
              mrp: true,
              amount: true,
            },
          },
        },
      }),
    ]);

    const [total, data] = result;

    return Success({
      data,
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (e) {
    console.error('Fetch medicine bills error:', e);
    return ApiError('Failed to fetch medicine bills');
  }
}


// POST /api/medicine-bills
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError('Invalid JSON body', 400);
  }

  const parsed = createMedicineBillSchema.safeParse(body);
  if (!parsed.success) return BadRequest(parsed.error.errors);

  const { patientId, discountPercent = 0, totalAmount, medicineBillDetails } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
       // Get current user's franchise ID, role, and team
  const currentUser = await tx.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    throwHttp('Current user not found', 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    throwHttp('Current user is not associated with any franchise', 400);
  }
      const now = new Date();
      const in90Days = new Date(now.getTime());
      in90Days.setDate(in90Days.getDate() + 90);

      // Validate and process each medicine item
      const processedItems: Array<{
        medicine: any;
        requestedQty: number;
        mrp: number;
        amount: number;
        batchAllocations: Array<{
          batchId: any;
          batchNumber: any;
          expiryDate: any;
          quantity: number;
        }>;
      }> = [];

      for (const item of medicineBillDetails) {
        // Get medicine details
        const medicine = await tx.medicine.findUnique({
          where: { id: item.medicineId },
          select: { id: true, name: true, rate: true, mrp: true, brand: { select: { name: true } } },
        });

        if (!medicine) {
          throwHttp(`Medicine with ID ${item.medicineId} not found`, 404);
        }

        // Find available stock batches (excluding expiring stock)
        const availableBatches = await tx.stockBatchBalance.findMany({
          where: {
            franchiseId,
            medicineId: item.medicineId,
            quantity: { gt: 0 },
            expiryDate: { gt: in90Days }, // Only stock expiring after 90 days
          },
          orderBy: { expiryDate: 'asc' }, // FIFO/FEFO - earliest expiry first
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            quantity: true,
          },
        });

        const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
        if (totalAvailable < item.qty) {
          const medicineDisplayName = `${medicine.name} - ${medicine.brand?.name || 'Unknown Brand'}`;
          throwHttp(
            `Insufficient stock for ${medicineDisplayName}. Available: ${totalAvailable}, Requested: ${item.qty}`,
            409
          );
        }

        // Calculate how to distribute quantity across batches
        let remainingQty = item.qty;
        const batchAllocations: Array<{
          batchId: any;
          batchNumber: any;
          expiryDate: any;
          quantity: number;
        }> = [];

        for (const batch of availableBatches) {
          if (remainingQty <= 0) break;

          const allocateQty = Math.min(remainingQty, batch.quantity);
          batchAllocations.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            quantity: allocateQty,
          });

          remainingQty -= allocateQty;
        }

        // Use amount from frontend
        const itemAmount = item.amount;

        processedItems.push({
          medicine,
          requestedQty: item.qty,
          mrp: item.mrp,
          amount: itemAmount,
          batchAllocations,
        });
      }

      // Use total amount from frontend (already discounted)
      const finalAmount = totalAmount;

      // Create medicine bill first (billNumber will be auto-generated by middleware)
      const medicineBill = await tx.medicineBill.create({
        data: {
          franchiseId,
          billNumber: '', // Temporary empty string - middleware will override this
          billDate: now,
          patientId,
          discountPercent,
          totalAmount: finalAmount,
        },
        select: { id: true, billNumber: true, totalAmount: true },
      });

      // Create stock transaction with reference to medicine bill
      const stockTransaction = await tx.stockTransaction.create({
        data: {
          txnType: 'FRANCHISE_TO_PATIENT_SALE',
          txnNo: '', // Will be auto-generated by middleware
          txnDate: now,
          franchiseId,
          createdByUserId: auth.user.id,
          medicineBillId: medicineBill.id, // Reference to the medicine bill
        },
        select: { id: true },
      });

      // Create medicine bill details and update stock
      for (const item of processedItems) {
        // Create bill detail
        await tx.medicineBillDetail.create({
          data: {
            medicineBillId: medicineBill.id,
            medicineId: item.medicine.id,
            qty: item.requestedQty,
            mrp: item.mrp,
            amount: item.amount,
          },
        });

        // Collect all stock ledger entries and batch updates for this item
        const stockLedgerEntries: Array<{
          transactionId: any;
          franchiseId: any;
          medicineId: any;
          batchNumber: any;
          expiryDate: any;
          qtyChange: number;
          rate: any;
          amount: number;
        }> = [];
        
        const batchBalanceUpdates: Array<{
          where: { id: any };
          data: { quantity: { decrement: number } };
        }> = [];

        for (const allocation of item.batchAllocations) {
          stockLedgerEntries.push({
            transactionId: stockTransaction.id,
            franchiseId,
            medicineId: item.medicine.id,
            batchNumber: allocation.batchNumber,
            expiryDate: allocation.expiryDate,
            qtyChange: -allocation.quantity, // Negative for stock out
            rate: item.medicine.rate,
            amount: item.medicine.rate * allocation.quantity,
          });

          batchBalanceUpdates.push({
            where: { id: allocation.batchId },
            data: { quantity: { decrement: allocation.quantity } },
          });
        }

        // Create stock ledger entries in batch
        if (stockLedgerEntries.length > 0) {
          await tx.stockLedger.createMany({
            data: stockLedgerEntries,
          });
        }

        // Update batch balances in batch
        for (const update of batchBalanceUpdates) {
          await tx.stockBatchBalance.update(update);
        }

        // Update overall stock balances
        for (const allocation of item.batchAllocations) {
          await tx.stockBalance.upsert({
            where: {
              franchiseId_medicineId: {
                franchiseId,
                medicineId: item.medicine.id,
              },
            },
            create: {
              franchiseId,
              medicineId: item.medicine.id,
              quantity: -allocation.quantity,
            },
            update: {
              quantity: { decrement: allocation.quantity },
            },
          });
        }
      }

      return {
        medicineBill,
        stockTransactionId: stockTransaction.id,
        totalItems: processedItems.length,
        totalAmount: finalAmount,
      };
    });

    return Success(result);
  } catch (e: unknown) {
    console.error('Create medicine bill error:', e);
    const anyErr = e as { message?: string; status?: number };
    if (typeof anyErr?.status === 'number') {
      return ApiError(anyErr.message || 'Failed to create medicine bill', anyErr.status);
    }
    if (e instanceof globalThis.Error) {
      return ApiError(e.message);
    }
    return ApiError('Failed to create medicine bill');
  }
}

// PATCH /api/medicine-bills/:id
// export async function PATCH(req: NextRequest) {
//   const auth = await guardApiAccess(req);
//   if (auth.ok === false) return auth.response;

//   const { searchParams } = new URL(req.url);
//   const id = searchParams.get('id');
//   const idNum = Number(id);
//   if (Number.isNaN(idNum)) return BadRequest('Invalid medicine bill ID');

//   try {
//     const body = await req.json();
//     const data = updateMedicineBillSchema.parse(body);

//     // Check if medicine bill exists
//     const existingBill = await prisma.medicineBill.findUnique({
//       where: { id: idNum },
//       select: { id: true, franchiseId: true }
//     });
//     if (!existingBill) {
//       return NotFound('Medicine bill not found');
//     }

//     // Check franchise access for franchise users
//     if (auth.user.role === 'FRANCHISE') {
//       const currentUser = await prisma.user.findUnique({
//         where: { id: auth.user.id },
//         select: { 
//           franchise: { select: { id: true } },
//           team: { select: { franchise: { select: { id: true } } } }
//         }
//       });
      
//       const userFranchiseId = currentUser?.franchise?.id || currentUser?.team?.franchise?.id;
//       if (!userFranchiseId || userFranchiseId !== existingBill.franchiseId) {
//         return Error('Forbidden', 403);
//       }
//     }

//     const result = await prisma.$transaction(async (tx: any) => {
//       // Get existing bill for comparison
//       const existingBillForUpdate = await tx.medicineBill.findUnique({
//         where: { id: idNum },
//         select: { discountPercent: true, totalAmount: true }
//       });

//       const shouldRecalcTotal = data.medicineBillDetails !== undefined || data.totalAmount !== undefined;

//       let finalAmount = existingBillForUpdate?.totalAmount;
      
//       // If totalAmount is provided in update, use it directly (frontend calculated)
//       if (data.totalAmount !== undefined) {
//         finalAmount = data.totalAmount;
//       }

//       const updateData: any = {};
//       if (data.patientId !== undefined) updateData.patientId = data.patientId;
//       if (data.discountPercent !== undefined) updateData.discountPercent = data.discountPercent;
//       if (finalAmount !== undefined) updateData.totalAmount = finalAmount;

//       // Update medicine bill
//       const medicineBill = await tx.medicineBill.update({
//         where: { id: idNum },
//         data: updateData,
//         select: { id: true, billNumber: true, totalAmount: true }
//       });

//       // Handle medicine bill details update
//       if (data.medicineBillDetails && data.medicineBillDetails.length > 0) {
//         // Get existing stock transaction to reverse stock changes
//         const existingStockTxn = await tx.stockTransaction.findUnique({
//           where: { medicineBillId: idNum },
//           select: { id: true }
//         });

//         if (existingStockTxn) {
//           // Reverse existing stock ledger entries
//           const existingLedgerLines = await tx.stockLedger.findMany({
//             where: { transactionId: existingStockTxn.id },
//             select: { 
//               franchiseId: true, 
//               medicineId: true, 
//               batchNumber: true, 
//               expiryDate: true, 
//               qtyChange: true 
//             }
//           });

//           // Reverse stock changes
//           for (const line of existingLedgerLines) {
//             await tx.stockBalance.upsert({
//               where: {
//                 franchiseId_medicineId: {
//                   franchiseId: line.franchiseId,
//                   medicineId: line.medicineId,
//                 },
//               },
//               create: {
//                 franchiseId: line.franchiseId,
//                 medicineId: line.medicineId,
//                 quantity: -line.qtyChange,
//               },
//               update: {
//                 quantity: { decrement: line.qtyChange },
//               },
//             });

//             if (line.batchNumber && line.expiryDate) {
//               await tx.stockBatchBalance.upsert({
//                 where: {
//                   franchiseId_medicineId_batchNumber_expiryDate: {
//                     franchiseId: line.franchiseId,
//                     medicineId: line.medicineId,
//                     batchNumber: line.batchNumber,
//                     expiryDate: line.expiryDate,
//                   },
//                 },
//                 create: {
//                   franchiseId: line.franchiseId,
//                   medicineId: line.medicineId,
//                   batchNumber: line.batchNumber,
//                   expiryDate: line.expiryDate,
//                   quantity: -line.qtyChange,
//                 },
//                 update: {
//                   quantity: { decrement: line.qtyChange },
//                 },
//               });
//             }
//           }

//           // Delete existing ledger entries
//           await tx.stockLedger.deleteMany({
//             where: { transactionId: existingStockTxn.id }
//           });
//         }

//         // Delete existing bill details
//         await tx.medicineBillDetail.deleteMany({
//           where: { medicineBillId: idNum }
//         });

//         // Process new medicine bill details
//         const processedItems: Array<{
//           medicine: any;
//           requestedQty: number;
//           mrp: any;
//           amount: number;
//           batchAllocations: Array<{
//             batchId: any;
//             batchNumber: any;
//             expiryDate: any;
//             quantity: number;
//           }>;
//         }> = [];
//         let now = new Date();

//         for (const item of data.medicineBillDetails) {
//           if (!item.medicineId || !item.qty) continue;

//           const medicine = await tx.medicine.findUnique({
//             where: { id: item.medicineId },
//             select: { id: true, name: true, rate: true, mrp: true }
//           });

//           if (!medicine) {
//             throw Error(`Medicine with ID ${item.medicineId} not found`);
//           }

//           // Get available stock batches (similar to POST logic)
//           const availableBatches = await tx.stockBatchBalance.findMany({
//             where: {
//               franchiseId: existingBill.franchiseId,
//               medicineId: item.medicineId,
//               quantity: { gt: 0 }
//             },
//             orderBy: [
//               { expiryDate: 'asc' },
//               { createdAt: 'asc' }
//             ],
//             include: {
//               batch: {
//                 select: {
//                   batchNumber: true,
//                   expiryDate: true
//                 }
//               }
//             }
//           });

//           let remainingQty = item.qty;
//           const batchAllocations: Array<{
//             batchId: any;
//             batchNumber: any;
//             expiryDate: any;
//             quantity: number;
//           }> = [];

//           for (const batch of availableBatches) {
//             if (remainingQty <= 0) break;

//             const availableQty = batch.quantity;
//             const allocateQty = Math.min(remainingQty, availableQty);

//             batchAllocations.push({
//               batchId: batch.id,
//               batchNumber: batch.batch.batchNumber,
//               expiryDate: batch.batch.expiryDate,
//               quantity: allocateQty,
//             });

//             remainingQty -= allocateQty;
//           }

//           if (remainingQty > 0) {
//             throw Error(`Insufficient stock for medicine ${medicine.name}. Required: ${item.qty}, Available: ${item.qty - remainingQty}`);
//           }

//           processedItems.push({
//             medicine,
//             requestedQty: item.qty,
//             mrp: item.mrp || medicine.mrp,
//             amount: item.amount || (item.mrp || medicine.mrp) * item.qty,
//             batchAllocations,
//           });
//         }

//         // Create new bill details
//         for (const item of processedItems) {
//           await tx.medicineBillDetail.create({
//             data: {
//               medicineBillId: medicineBill.id,
//               medicineId: item.medicine.id,
//               qty: item.requestedQty,
//               mrp: item.mrp,
//               amount: item.amount,
//             },
//           });

//           // Create new stock ledger entries and update balances
//           const stockLedgerEntries: Array<{
//             transactionId: any;
//             franchiseId: number | null;
//             medicineId: any;
//             batchNumber: any;
//             expiryDate: any;
//             qtyChange: number;
//             rate: any;
//             amount: number;
//           }> = [];
          
//           const batchBalanceUpdates: Array<{
//             where: { id: any };
//             data: { quantity: { decrement: number } };
//           }> = [];

//           for (const allocation of item.batchAllocations) {
//             stockLedgerEntries.push({
//               transactionId: existingStockTxn?.id,
//               franchiseId: existingBill.franchiseId,
//               medicineId: item.medicine.id,
//               batchNumber: allocation.batchNumber,
//               expiryDate: allocation.expiryDate,
//               qtyChange: -allocation.quantity,
//               rate: item.medicine.rate,
//               amount: item.medicine.rate * allocation.quantity,
//             });

//             batchBalanceUpdates.push({
//               where: { id: allocation.batchId },
//               data: { quantity: { decrement: allocation.quantity } },
//             });
//           }

//           // Create stock ledger entries in batch
//           if (stockLedgerEntries.length > 0) {
//             await tx.stockLedger.createMany({
//               data: stockLedgerEntries,
//             });
//           }

//           // Update batch balances
//           for (const update of batchBalanceUpdates) {
//             await tx.stockBatchBalance.update(update);
//           }

//           // Update overall stock balances
//           for (const allocation of item.batchAllocations) {
//             await tx.stockBalance.upsert({
//               where: {
//                 franchiseId_medicineId: {
//                   franchiseId: existingBill.franchiseId,
//                   medicineId: item.medicine.id,
//                 },
//               },
//               create: {
//                 franchiseId: existingBill.franchiseId,
//                 medicineId: item.medicine.id,
//                 quantity: -allocation.quantity,
//               },
//               update: {
//                 quantity: { decrement: allocation.quantity },
//               },
//             });
//           }
//         }
//       }

//       return {
//         medicineBill,
//         totalItems: data.medicineBillDetails?.length || 0,
//         totalAmount: finalAmount,
//       };
//     });

//     return Success(result);
//   } catch (e: unknown) {
//     if (e instanceof z.ZodError) {
//       return BadRequest(e.errors);
//     }
//     console.error('Update medicine bill error:', e);
//     if (e instanceof Error) {
//       return Error((e as Error).message);
//     }
//     return Error('Failed to update medicine bill');
//   }
// }

