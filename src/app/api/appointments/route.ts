import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

// Schema for appointment creation
const appointmentSchema = z.object({
  appointmentDateTime: z.string().min(1, "Appointment date and time is required"),
  teamId: z.number().int().positive("Team ID is required"),
  visitPurpose: z.string().optional(),
  patientId: z.number().int().positive().optional(),
  patient: z.object({
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    dateOfBirth: z.string().optional(),
    age: z.number().int().positive(),
    gender: z.string(),
    referedBy: z.string().optional(),
    email: z.string().email(),
    mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits"),
  }).optional(),
}).refine((data) => {
  // Either patientId OR patient must be provided, but not both
  const hasPatientId = !!data.patientId;
  const hasPatientData = !!data.patient;
  return (hasPatientId && !hasPatientData) || (!hasPatientId && hasPatientData);
}, {
  message: "Either patient (for existing patients) OR patient data (for new patients) must be provided, but not both",
});

const appointmentUpdateSchema = z.object({
  appointmentDateTime: z.string().optional(),
  teamId: z.number().int().positive().optional(),
  visitPurpose: z.string().optional(),
});

// GET /api/appointments
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "appointmentDateTime") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

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

  const where: any = {
    franchiseId: currentUser.franchise.id,
  };
  
  if (search) {
    where.OR = [
      { patient: { firstName: { contains: search } } },
      { patient: { middleName: { contains: search } } },
      { patient: { lastName: { contains: search } } },
      { patient: { mobile: { contains: search } } },
      { visitPurpose: { contains: search } },
    ];
  }

  const sortableFields = new Set(["appointmentDateTime", "createdAt", "visitPurpose"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { appointmentDateTime: "desc" };

  const result = await paginate({
    model: prisma.appointment,
    where,
    orderBy,
    page,
    perPage,
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

  return Success(result);
}

// POST /api/appointments
export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }

  try {
    const data = appointmentSchema.parse(body);
    const { appointmentDateTime, teamId, visitPurpose, patientId, patient } = data;

    const created = await prisma.$transaction(async (tx) => {
      let finalPatientId: number;

      // Verify team belongs to the same franchise
      const team = await tx.team.findUnique({
        where: { id: teamId, franchiseId },
        select: { id: true }
      });

      if (!team) {
        throw Error("Team does not belong to your franchise");
      }

      if (patientId) {
        // Use existing patient
        const existingPatient = await tx.patient.findFirst({
          where: {
            id: patientId,
            franchiseId
          }
        });

        if (!existingPatient) {
          throw Error("Patient not found or does not belong to your franchise");
        }

        finalPatientId = existingPatient.id;
      } else if (patient) {
        // Create new patient
        const existingPatient = await tx.patient.findFirst({
          where: {
            mobile: patient.mobile,
            franchiseId
          }
        });

        if (existingPatient) {
          finalPatientId = existingPatient.id;
        } else {
          // Generate patientNo using the same logic as patients route
          const now = new Date();
          const dateKey = now.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
          
          const seq = await tx.patientSequence.upsert({
            where: { dateKey },
            update: { lastNumber: { increment: 1 } },
            create: { dateKey, lastNumber: 1 },
            select: { lastNumber: true },
          });

          const patientNo = `P-${dateKey}-${String(seq.lastNumber).padStart(4, "0")}`;

          const newPatient = await tx.patient.create({
            data: {
              patientNo,
              firstName: patient.firstName,
              middleName: patient.middleName,
              lastName: patient.lastName,
              dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : null,
              age: patient.age,
              gender: patient.gender,
              referedBy: patient.referedBy,
              email: patient.email,
              mobile: patient.mobile,
              teamId,
              franchiseId,
            },
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
          });

          finalPatientId = newPatient.id;
        }
      } else {
        throw Error("Either patientId or patient data must be provided");
      }

      // Create appointment with the determined patient ID
      const appointment = await tx.appointment.create({
        data: {
          appointmentDateTime: new Date(appointmentDateTime),
          teamId,
          patientId: finalPatientId,
          visitPurpose,
          franchiseId,
        },
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

      return appointment;
    });

    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Failed to create appointment:", error);
    const err = error as { code?: string; message?: string };
    if (err?.code === "P2002") return Error("Appointment already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for appointments. Run Prisma migrate.", 500);
    if (err?.code === "P2025") return Error("Team not found", 404);
    if (
      error instanceof TypeError &&
      (String(error.message).includes("prisma.appointment") || String(error.message).includes("undefined"))
    ) {
      return Error(
        "Prisma client is out of date. Run prisma generate and restart dev server.",
        500
      );
    }
    return Error((err?.message as string) || "Failed to create appointment");
  }
}

// PATCH /api/appointments
export async function PATCH(req: NextRequest) {
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
    
    if (!id) {
      return BadRequest('Appointment ID is required');
    }
    
    const appointmentId = Number(id);
    if (Number.isNaN(appointmentId)) {
      return BadRequest('Invalid appointment ID');
    }
    
    // Verify appointment belongs to the user's franchise
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
