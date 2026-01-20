import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';

// Schema for appointment update
const appointmentUpdateSchema = z.object({
  appointmentDateTime: z.string().optional(),
  teamId: z.number().int().positive().optional(),
  visitPurpose: z.string().optional(),
});

// GET /api/appointments/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      franchise: {
        select: { id: true }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  if (!currentUser.franchise) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    const record = await prisma.appointment.findUnique({
      where: { id: idNum, franchiseId: currentUser.franchise.id },
      select: {
        id: true,
        appointmentDateTime: true,
        visitPurpose: true,
        createdAt: true,
        updatedAt: true,
        patient: {
          select: {
            id: true,
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
    
    if (!record) return Error('Appointment not found', 404);
    return Success(record);
  } catch {
    return Error('Failed to fetch appointment');
  }
}

// PATCH /api/appointments/:id
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      franchise: {
        select: { id: true }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  if (!currentUser.franchise) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const franchiseId = currentUser.franchise.id;
  
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    const appointmentId = Number((await context.params).id);
    if (Number.isNaN(appointmentId)) {
      return BadRequest('Invalid appointment ID');
    }
    
    // Verify the appointment belongs to the user's franchise
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId, franchiseId },
      select: { id: true }
    });

    if (!existingAppointment) {
      return Error("Appointment not found", 404);
    }
    
    const parsedData = appointmentUpdateSchema.parse(updateData);

    // If teamId is being updated, verify the new team belongs to the same franchise
    if (parsedData.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: parsedData.teamId, franchiseId },
        select: { id: true }
      });

      if (!team) {
        return Error("Team does not belong to your franchise", 403);
      }
    }

    const data: Record<string, unknown> = {};
    
    if (parsedData.appointmentDateTime) {
      data.appointmentDateTime = new Date(parsedData.appointmentDateTime);
    }
    if (parsedData.teamId) {
      data.teamId = parsedData.teamId;
    }
    if (parsedData.visitPurpose !== undefined) {
      data.visitPurpose = parsedData.visitPurpose;
    }

    if (Object.keys(data).length === 0) {
      return BadRequest("Nothing to update");
    }
    
    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data,
      select: {
        id: true,
        appointmentDateTime: true,
        visitPurpose: true,
        createdAt: true,
        updatedAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            mobile: true,
            email: true,
            age: true,
            gender: true,
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
    
    return Success(appointment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Update appointment error:', error);
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2025') return Error('Appointment not found', 404);
    if (err?.code === 'P2002') return Error('Appointment already exists', 409);
    return Error('Failed to update appointment');
  }
}

// DELETE /api/appointments/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      franchise: {
        select: { id: true }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  if (!currentUser.franchise) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  
  try {
    const record = await prisma.appointment.findUnique({
      where: { id: idNum, franchiseId: currentUser.franchise.id },
      select: { id: true }
    });
    
    if (!record) return Error('Appointment not found', 404);
    
    await prisma.appointment.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Appointment not found', 404);
    return Error('Failed to delete appointment');
  }
}
