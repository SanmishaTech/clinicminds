import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';

// Schema for updating consultation receipt
const updateConsultationReceiptSchema = z.object({
  date: z.string().datetime().optional(),
  paymentMode: z.string().min(1).optional(),
  payerName: z.string().optional(),
  contactNumber: z.string().optional(),
  utrNumber: z.string().optional(),
  chequeDate: z.string().datetime().optional(),
  chequeNumber: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().positive().optional(),
});

type UpdateConsultationReceiptInput = z.infer<typeof updateConsultationReceiptSchema>;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return BadRequest("Invalid receipt ID");
    }

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

    const receipt = await prisma.consultationReceipt.findFirst({
      where: {
        id,
        consultation: {
          appointment:{
            patient: {
              franchiseId: franchiseId
            }
        }
        }
      },
      include: {
        consultation: {
          select: {
            id: true,
            totalAmount: true,
            appointment:{ 
              select:
              {
                patient: {
                  select: {
                    id: true,
                    patientNo: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    mobile: true,
                  }
                }
              }
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

    if (!receipt) {
      return NotFound("Consultation receipt not found");
    }

    return Success(receipt);

  } catch (error) {
    console.error('Consultation receipt GET error:', error);
    return Error("Failed to fetch consultation receipt", 500);
  }
}

