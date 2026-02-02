import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const receiptId = parseInt(params.id);
  if (isNaN(receiptId)) {
    return Error('Invalid receipt ID');
  }

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

  const receipt = await prisma.medicineBillReceipt.findUnique({
    where: { id: receiptId },
    include: {
      medicineBill: {
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          totalAmount: true,
          totalReceivedAmount: true,
          discountPercent: true,
          franchiseId: true,
          patient: {
            select: {
              id: true,
              patientNo: true,
              firstName: true,
              middleName: true,
              lastName: true,
              gender: true,
              mobile: true
            }
          },
          medicineDetails: {
            include: {
              medicine: {
                select: {
                  id: true,
                  name: true,
                  mrp: true
                }
              }
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

  if (!receipt) {
    return Error('Medicine bill receipt not found');
  }

  // Check franchise access if not super admin
  if (franchiseId && receipt.medicineBill?.franchiseId !== franchiseId) {
    return Error('Access denied');
  }

  return Success(receipt);
}
