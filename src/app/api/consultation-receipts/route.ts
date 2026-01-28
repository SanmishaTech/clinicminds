import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { z } from 'zod';

// Schema for creating consultation receipt
const createConsultationReceiptSchema = z.object({
  consultationId: z.number().positive(),
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

// Schema for updating consultation receipt
const updateConsultationReceiptSchema = createConsultationReceiptSchema.partial();

type CreateConsultationReceiptInput = z.infer<typeof createConsultationReceiptSchema>;
type UpdateConsultationReceiptInput = z.infer<typeof updateConsultationReceiptSchema>;

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
    return Error("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const consultationId = searchParams.get('consultationId')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'createdAt';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

  const sortable = new Set(['createdAt', 'updatedAt', 'date', 'amount', 'receiptNumber']);
  const orderBy: Record<string, 'asc' | 'desc'> = sortable.has(sort)
    ? { [sort]: order }
    : { createdAt: 'desc' };

  try {
    const where = {
      consultation: {
        // Filter by franchise through consultation's appointment
        appointment: {
          patient: {
            franchiseId: franchiseId
          }
        }
      },
      ...(consultationId && { consultationId: parseInt(consultationId) }),
      ...(search && {
        OR: [
          { receiptNumber: { contains: search, mode: 'insensitive' as const } },
          { payerName: { contains: search, mode: 'insensitive' as const } },
          { contactNumber: { contains: search, mode: 'insensitive' as const } },
          { utrNumber: { contains: search, mode: 'insensitive' as const } },
          { chequeNumber: { contains: search, mode: 'insensitive' as const } },
          { paymentMode: { contains: search, mode: 'insensitive' as const } },
          { notes: { contains: search, mode: 'insensitive' as const } },
        ]
      })
    };

    const result = await paginate({
      model: prisma.consultationReceipt,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        receiptNumber: true,
        consultationId: true,
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
        consultation: {
          select: {
            id: true,
            totalAmount: true,
            appointment:{
              select:{
                patient: {
              select: {
                id: true,
                patientNo: true,
                firstName: true,
                middleName: true,
                lastName: true,
                mobile: true,
              }
            }}
            }
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return Success({
      data: result.data,
      pagination: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages
      }
    });

  } catch (error) {
    console.error('Consultation receipts GET error:', error);
    return Error("Failed to fetch consultation receipts", 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const validatedData = createConsultationReceiptSchema.parse(body);

    // Get current user's franchise ID
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
      return Error("Current user not found", 404);
    }

    const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
    
    if (!franchiseId) {
      return Error("Current user is not associated with any franchise", 400);
    }

    // Verify consultation exists and belongs to the same franchise
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: validatedData.consultationId,
        appointment:{
          patient: {
            franchiseId: franchiseId
          }
        }
      }
    });

    if (!consultation) {
      return Error("Consultation not found or access denied", 404);
    }

    // Create consultation receipt and update consultation totalReceivedAmount in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create consultation receipt (receipt number will be auto-generated by middleware)
      const receipt = await tx.consultationReceipt.create({
        data: {
          receiptNumber: '',
          consultationId: validatedData.consultationId,
          date: new Date(validatedData.date),
          paymentMode: validatedData.paymentMode,
          payerName: validatedData.payerName,
          contactNumber: validatedData.contactNumber,
          utrNumber: validatedData.utrNumber,
          chequeDate: validatedData.chequeDate ? new Date(validatedData.chequeDate) : null,
          chequeNumber: validatedData.chequeNumber,
          notes: validatedData.notes,
          amount: validatedData.amount,
          createdByUserId: auth.user.id,
        },
        include: {
          consultation: {
            select: {
              id: true,
              totalAmount: true,
              appointment:{
                select:{
                  patient: {
                select: {
                  id: true,
                  patientNo: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  mobile: true,
                }
              }}
            }
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          }
        }
      }
      });

      // Update consultation's totalReceivedAmount only if receipt was created successfully
      if (receipt) {
        const currentReceivedAmount = Number(consultation.totalReceivedAmount || 0);
        await tx.consultation.update({
          where: { id: validatedData.consultationId },
          data: {
            totalReceivedAmount: currentReceivedAmount + validatedData.amount
          }
        });
      }

      return receipt;
    });

    return Success(result, 201);

  } catch (error) {
    console.error('Consultation receipt creation error:', error);
    
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    
    return Error("Failed to create consultation receipt", 500);
  }
}
