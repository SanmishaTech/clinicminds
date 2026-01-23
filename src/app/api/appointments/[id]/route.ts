import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/appointments/:id
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
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError('Invalid id', 400);
  
  try {
    const record = await prisma.appointment.findUnique({
      where: { id: idNum, franchiseId },
      select: {
        id: true,
        patientId: true, 
        appointmentDateTime: true,
        visitPurpose: true,
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
            email: true,
            age: true,
            gender: true,
            dateOfBirth: true,
            referedBy: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!record) return ApiError('Appointment not found', 404);
    
    // Role-based access check: DOCTOR can only access appointments from their team
    if (currentUser.role === 'DOCTOR' && currentUser.team && record.team?.id !== currentUser.team.id) {
      return ApiError('Access denied: You can only view appointments from your team', 403);
    }
    
    return Success(record);
  } catch {
    return ApiError('Failed to fetch appointment');
  }
}



// DELETE /api/appointments/:id
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
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError('Invalid id', 400);
  
  try {
    const record = await prisma.appointment.findUnique({
      where: { id: idNum, franchiseId },
      select: { id: true, teamId: true }
    });
    
    if (!record) return ApiError('Appointment not found', 404);
    
    // Role-based access check: DOCTOR can only delete appointments from their team
    if (currentUser.role === 'DOCTOR' && currentUser.team && record.teamId !== currentUser.team.id) {
      return ApiError('Access denied: You can only delete appointments from your team', 403);
    }
    
    await prisma.appointment.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return ApiError('Appointment not found', 404);
    return ApiError('Failed to delete appointment');
  }
}
