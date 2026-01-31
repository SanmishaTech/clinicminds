import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { z } from 'zod';

// Schema for creating medicine bill receipt
const createMedicineBillReceiptSchema = z.object({
  medicineBillId: z.number().positive(),
  date: z.string().datetime(),
  paymentMode: z.string().min(1),
  payerName: z.string().optional(),
  contactNumber: z.string().optional(),
  utrNumber: z.string().optional(),
  chequeDate: z.string().datetime().optional().nullable(),
  chequeNumber: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().positive(),
});

// Schema for updating medicine bill receipt
const updateMedicineBillReceiptSchema = createMedicineBillReceiptSchema.partial();

type CreateMedicineBillReceiptInput = z.infer<typeof createMedicineBillReceiptSchema>;
type UpdateMedicineBillReceiptInput = z.infer<typeof updateMedicineBillReceiptSchema>;

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

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
    return Error('User not found');
  }

  // Determine franchise ID based on user role
  const franchiseId = currentUser.role === 'SUPER_ADMIN' 
    ? undefined 
    : (currentUser.franchise?.id || currentUser.team?.franchise?.id);

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '10');
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') || 'desc';
  const search = searchParams.get('search') || '';

  const where: any = {};

  // Filter by franchise if not super admin
  if (franchiseId) {
    where.medicineBill = {
      franchiseId: franchiseId
    };
  }

  // Add search condition
  if (search) {
    where.OR = [
      { receiptNumber: { contains: search } },
      { payerName: { contains: search } },
      { paymentMode: { contains: search } },
      { notes: { contains: search } }
    ];
  }

  const result = await paginate({
    model: prisma.medicineBillReceipt,
    where,
    orderBy: {
      [sort]: order as 'asc' | 'desc'
    },
    page,
    perPage,
    select: {
      id: true,
      receiptNumber: true,
      medicineBillId: true,
      date: true,
      paymentMode: true,
      payerName: true,
      contactNumber: true,
      utrNumber: true,
      chequeDate: true,
      chequeNumber: true,
      notes: true,
      amount: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      medicineBill: {
        select: {
          id: true,
          billNumber: true,
          totalAmount: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true
            }
          }
        }
      },
      createdByUser: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return Success(result);
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

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
    return Error('User not found');
  }

  // Determine franchise ID based on user role
  const franchiseId = currentUser.role === 'SUPER_ADMIN' 
    ? undefined 
    : (currentUser.franchise?.id || currentUser.team?.franchise?.id);

  const body = await req.json();
  const validatedData = createMedicineBillReceiptSchema.parse(body);

  // Validate that the medicine bill exists and belongs to the user's franchise
  const medicineBill = await prisma.medicineBill.findFirst({
    where: {
      id: validatedData.medicineBillId,
      ...(franchiseId && { franchiseId: franchiseId })
    },
    include: {
      patient: {
        select: {
          id: true,
          balanceAmount: true
        }
      }
    }
  });

  if (!medicineBill) {
    return Error('Medicine bill not found or access denied');
  }

  // Validate receipt amount against remaining balance
  const currentReceivedAmount = Number(medicineBill.totalReceivedAmount || 0);
  const totalBillAmount = Number(medicineBill.totalAmount);
  const remainingBalance = totalBillAmount - currentReceivedAmount;

  if (validatedData.amount > remainingBalance) {
    return BadRequest(`Receipt amount (${validatedData.amount}) exceeds remaining balance (${remainingBalance})`);
  }

  // Create medicine bill receipt and update medicine bill totalReceivedAmount in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.medicineBillReceipt.create({
      data: {
        receiptNumber: '', // Will be auto-generated by middleware
        medicineBillId: validatedData.medicineBillId,
        date: validatedData.date ? new Date(validatedData.date) : new Date(),
        paymentMode: validatedData.paymentMode || '',
        payerName: validatedData.payerName || '',
        contactNumber: validatedData.contactNumber || '',
        upiName: '', // Not in schema, keeping empty for consistency
        utrNumber: validatedData.utrNumber || '',
        bankName: '', // Not in schema, keeping empty for consistency
        amount: validatedData.amount,
        chequeNumber: validatedData.chequeNumber || '',
        chequeDate: validatedData.chequeDate ? new Date(validatedData.chequeDate) : null,
        notes: validatedData.notes || '',
        createdByUserId: auth.user.id,
      },
    });

    // Update medicine bill's totalReceivedAmount only if receipt was created successfully
    if (receipt) {
      const currentReceivedAmount = Number(medicineBill.totalReceivedAmount || 0);
      await tx.medicineBill.update({
        where: { id: validatedData.medicineBillId },
        data: {
          totalReceivedAmount: currentReceivedAmount + validatedData.amount
        }
      });

      // Update patient's balanceAmount (reduce by the receipt amount only)
      const patientId = medicineBill.patient?.id;
      if (patientId && medicineBill.patient) {
        const currentBalanceAmount = Number(medicineBill.patient.balanceAmount || 0);
        await tx.patient.update({
          where: { id: patientId },
          data: {
            balanceAmount: Math.max(0, currentBalanceAmount - validatedData.amount)
          }
        });
      }
    }

    return receipt;
  });

  if ((result as any)?.error) {
    return Error((result as any)?.error || 'Failed to create medicine bill receipt');
  }

  return Success(result);
}
