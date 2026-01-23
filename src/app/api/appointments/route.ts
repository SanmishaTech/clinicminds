import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { MASTER_CONFIG } from "@/config/master";
import { z } from "zod";

const GENDER_VALUES = new Set(MASTER_CONFIG.gender.map((g) => g.value));

function normalizeGender(input: unknown): string {
  if (typeof input !== "string") return "";
  const v = input.trim();
  if (!v) return "";
  const upper = v.toUpperCase();
  if (GENDER_VALUES.has(upper as any)) return upper;
  const found = MASTER_CONFIG.gender.find((g) => g.label.toLowerCase() === v.toLowerCase());
  return found?.value || "";
}

type AppointmentListItem = {
  id: number;
  appointmentDateTime: string;
  visitPurpose: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: number;
    patientNo: string;
    firstName: string;
    middleName: string;
    lastName: string;
    mobile: string;
    email: string | null;
    age: number | null;
    gender: string | null;
  };
  team: {
    id: number;
    name: string;
  };
};

// Schema for appointment creation
const appointmentSchema = z.object({
  appointmentDateTime: z.string().min(1, "Appointment date and time is required"),
  teamId: z.number().int().positive("Team ID is required"),
  visitPurpose: z.string().optional(),
  patientId: z.number().int().positive("Patient ID is required"),
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
  const team = searchParams.get("team")?.trim() || "";
  const gender = searchParams.get("gender")?.trim() || "";
  const startDate = searchParams.get("startDate")?.trim() || "";
  const endDate = searchParams.get("endDate")?.trim() || "";
  const sort = (searchParams.get("sort") || "appointmentDateTime") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

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

  const where: any = {
    franchiseId,
  };

  // Role-based filtering: DOCTOR can only see appointments from their team
  if (currentUser.role === 'DOCTOR' && currentUser.team) {
    where.teamId = currentUser.team.id;
  }
  
  if (search) {
    where.OR = [
      { patient: { firstName: { contains: search } } },
      { patient: { middleName: { contains: search } } },
      { patient: { lastName: { contains: search } } },
      { patient: { mobile: { contains: search } } },
      { visitPurpose: { contains: search } },
    ];
  }
  if (team) where.teamId = Number(team);
  if (gender) {
    const g = normalizeGender(gender);
    if (!g) return ApiError("Invalid gender", 400);
    where.patient = { ...where.patient, gender: g };
  }
  if (startDate || endDate) {
    where.appointmentDateTime = {};
    if (startDate) {
      where.appointmentDateTime.gte = new Date(startDate);
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setDate(endDateTime.getDate() + 1); // Include the entire end day
      where.appointmentDateTime.lt = endDateTime;
    }
  }

  const sortableFields = new Set(["appointmentDateTime", "createdAt", "visitPurpose", "gender"]);
  let orderBy: any;
  
  if (sortableFields.has(sort)) {
    if (sort === "gender") {
      // Handle nested gender sorting
      orderBy = { patient: { gender: order } };
    } else {
      orderBy = { [sort]: order };
    }
  } else {
    orderBy = { appointmentDateTime: "desc" };
  }

  try {
    const appointmentModel = (prisma as any).appointment;
    if (!appointmentModel) return ApiError("Prisma client is out of date. Run prisma generate and restart the dev server.", 500);

    const result = await paginate<any, any, AppointmentListItem>({
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
          patientNo: true,
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
  } catch (e: unknown) {
    console.error("Failed to list appointments:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2021") return ApiError("Database not migrated for appointments. Run Prisma migrate.", 500);
    if (
      err instanceof TypeError &&
      (String(err.message).includes("prisma.appointment") || String(err.message).includes("undefined"))
    ) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart dev server.",
        500
      );
    }
    return ApiError((err?.message as string) || "Failed to list appointments");
  }
}
// POST /api/appointments
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
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError("Invalid JSON body", 400);
  }

  try {
    const data = appointmentSchema.parse(body);
    const { appointmentDateTime, teamId, visitPurpose, patientId } = data;

    const created = await prisma.$transaction(async (tx) => {
      // Verify team belongs to the same franchise
      const team = await tx.team.findUnique({
        where: { id: teamId, franchiseId },
        select: { id: true }
      });

      if (!team) {
        throw ApiError("Team does not belong to your franchise");
      }

      // Verify patient belongs to the same franchise
      const patient = await tx.patient.findFirst({
        where: {
          id: patientId,
          franchiseId
        }
      });

      if (!patient) {
        throw ApiError("Patient not found or does not belong to your franchise");
      }

      // Create appointment
      const appointment = await tx.appointment.create({
        data: {
          appointmentDateTime: new Date(appointmentDateTime),
          teamId,
          patientId,
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
      return ApiError(error.errors[0]?.message || "Validation failed", 400);
    }
    console.error("Failed to create appointment:", error);
    const err = error as { code?: string; message?: string };
    if (err?.code === "P2002") return ApiError("Appointment already exists", 409);
    if (err?.code === "P2021") return ApiError("Database not migrated for appointments. Run Prisma migrate.", 500);
    if (err?.code === "P2025") return ApiError("Team not found", 404);
    if (
      error instanceof TypeError &&
      (String(error.message).includes("prisma.appointment") || String(error.message).includes("undefined"))
    ) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart dev server.",
        500
      );
    }
    return ApiError((err?.message as string) || "Failed to create appointment");
  }
}

// PATCH /api/appointments
export async function PATCH(req: NextRequest) {
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
  
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return ApiError('Appointment ID is required', 400);
    }
    
    const appointmentId = Number(id);
    if (Number.isNaN(appointmentId)) {
      return ApiError('Invalid appointment ID', 400);
    }
    
    // Verify appointment belongs to the user's franchise
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId, franchiseId },
      select: { id: true, teamId: true }
    });

    if (!existingAppointment) {
      return ApiError("Appointment not found", 404);
    }
    
    // Role-based access check: DOCTOR can only update appointments from their team
    if (currentUser.role === 'DOCTOR' && currentUser.team && existingAppointment.teamId !== currentUser.team.id) {
      return ApiError('Access denied: You can only update appointments from your team', 403);
    }
    
    const parsedData = appointmentUpdateSchema.parse(updateData);

    // If teamId is being updated, verify the new team belongs to the same franchise
    if (parsedData.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: parsedData.teamId, franchiseId },
        select: { id: true }
      });

      if (!team) {
        return ApiError("Team does not belong to your franchise", 403);
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
      return ApiError("Nothing to update", 400);
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
      return ApiError(error.errors[0]?.message || "Validation failed", 400);
    }
    console.error('Update appointment error:', error);
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2025') return ApiError('Appointment not found', 404);
    if (err?.code === 'P2002') return ApiError('Appointment already exists', 409);
    return ApiError('Failed to update appointment');
  }
}
