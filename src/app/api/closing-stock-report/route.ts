import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/closing-stock-report
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const franchiseId = searchParams.get('franchiseId');
  const medicineId = searchParams.get('medicineId');

  // Validate required parameters
  if (!franchiseId) {
    return BadRequest('franchiseId is required');
  }
  if (!medicineId) {
    return BadRequest('medicineId is required');
  }

  try {
    const franchiseIdNum = parseInt(franchiseId);
    const medicineIdNum = parseInt(medicineId);

    if (isNaN(franchiseIdNum) || isNaN(medicineIdNum)) {
      return BadRequest('Invalid franchiseId or medicineId format');
    }

    // Fetch stock balance data
    const stockBalance = await prisma.stockBalance.findUnique({
      where: {
        franchiseId_medicineId: {
          franchiseId: franchiseIdNum,
          medicineId: medicineIdNum
        }
      },
      include: {
        franchise: {
          select: {
            id: true,
            name: true
          }
        },
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
    });

    // If no stock balance found, return empty result with basic info
    if (!stockBalance) {
      const basicInfo = await prisma.franchise.findUnique({
        where: { id: franchiseIdNum },
        select: { id: true, name: true }
      });

      const medicineInfo = await prisma.medicine.findUnique({
        where: { id: medicineIdNum },
        select: { 
          id: true, 
          name: true,
          brand: {
            select: { name: true }
          }
        }
      });

      return Success({
        franchiseId: franchiseIdNum,
        medicineId: medicineIdNum,
        quantity: 0,
        franchise: basicInfo,
        medicine: medicineInfo,
        message: 'No stock balance found for this franchise and medicine combination'
      });
    }

    return Success(stockBalance);

  } catch (error) {
    console.error('Error fetching closing stock report:', error);
    return Error('Failed to fetch closing stock report');
  }
}
