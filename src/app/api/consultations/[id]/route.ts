import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    const record = await prisma.consultation.findFirst({
      where: { 
        id: idNum,
        appointment: {
          franchiseId,
          ...(currentUser.role === 'DOCTOR' && currentUser.team ? { teamId: currentUser.team.id } : {}),
        }
      },
      select: {
        id: true,
        appointmentId: true,
        complaint: true,
        diagnosis: true,
        remarks: true,
        casePaperUrl: true,
        nextFollowUpDate: true,
        totalAmount: true,
        totalReceivedAmount: true,
        createdAt: true,
        updatedAt: true,
        appointment: {
          select: {
            id: true,
            appointmentDateTime: true,
            visitPurpose: true,
            patient: {
              select: {
                id: true,
                patientNo: true,
                firstName: true,
                middleName: true,
                lastName: true,
                mobile: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consultationDetails: {
          select: {
            id: true,
            serviceId: true,
            description: true,
            qty: true,
            rate: true,
            amount: true,
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consultationMedicines: {
          select: {
            id: true,
            medicineId: true,
            qty: true,
            mrp: true,
            amount: true,
            doses: true,
            medicine: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!record) return Error('Consultation not found', 404);
    return Success(record);
  } catch (e) {
    console.error('Error fetching consultation:', e);
    return Error('Failed to fetch consultation');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);

  try {
    // First check if the consultation exists and user has access
    const consultation = await prisma.consultation.findFirst({
      where: { 
        id: idNum,
        appointment: {
          franchiseId,
          ...(currentUser.role === 'DOCTOR' && currentUser.team ? { teamId: currentUser.team.id } : {}),
        }
      },
      select: { id: true }
    });

    if (!consultation) {
      return Error('Consultation not found', 404);
    }

    await prisma.consultation.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Consultation not found', 404);
    console.error('Error deleting consultation:', e);
    return Error('Failed to delete consultation');
  }
}
