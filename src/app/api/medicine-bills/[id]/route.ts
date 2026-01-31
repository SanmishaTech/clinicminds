import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/medicine-bills/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt(params.id);
  if (isNaN(id)) {
    return Error('Invalid medicine bill ID', 400);
  }

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
      return Error("Current user not found", 404);
    }

    // Get franchise ID from either direct assignment or through team
    const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
    
    if (!franchiseId) {
      return Error("Current user is not associated with any franchise", 400);
    }

    // Build where clause based on user role
    let whereClause: any = { id };
    
    // If not admin, restrict to user's franchise
    if (currentUser.role !== 'ADMIN') {
      whereClause.franchiseId = franchiseId;
    }

    // Fetch medicine bill with all related data
    const medicineBill = await prisma.medicineBill.findFirst({
      where: whereClause,
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        discountPercent: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        patient: {
          select: {
            id: true,
            patientNo: true,
            firstName: true,
            middleName: true,
            lastName: true,
            mobile: true,
          }
        },
        franchise: {
          select: {
            id: true,
            name: true,
          }
        },
        medicineDetails: {
          select: {
            id: true,
            qty: true,
            mrp: true,
            amount: true,
            medicine: {
              select: {
                id: true,
                name: true,
                brand: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        stockTransaction: {
          select: {
            id: true,
            txnNo: true,
            txnDate: true,
          }
        }
      }
    });

    if (!medicineBill) {
      return NotFound('Medicine bill not found');
    }

    const normalized = {
      ...(medicineBill as any),
      medicineDetails: ((medicineBill as any).medicineDetails || []).map((d: any) => ({
        ...d,
        medicine: d.medicine
          ? {
              ...d.medicine,
              brand: d.medicine?.brand?.name ?? null,
            }
          : d.medicine,
      })),
    };

    return Success(normalized);
  } catch (error) {
    console.error('Error fetching medicine bill:', error);
    return Error('Internal server error', 500);
  }
}
