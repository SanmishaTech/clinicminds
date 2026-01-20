import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { teamSchema } from "@/lib/schemas/backend/teams";


export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const statusParam = searchParams.get("status");
  const sort = (searchParams.get("sort") || "createdAt") as string;
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
      { name: { contains: search } },
      { city: { contains: search } },
      { state: { contains: search } },
      { user: { email: { contains: search } } },
    ];
  }

  if (statusParam === "true" || statusParam === "false") {
    where.user = { status: statusParam === "true" };
  }

  const sortableFields = new Set(["name", "city", "state", "createdAt", "joiningDate"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  const result = await paginate({
    model: prisma.team,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      name: true,
      joiningDate: true,
      leavingDate: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      pincode: true,
      userMobile: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: true,
        },
      },
    },
  });

  return Success(result);
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }

  try {
    const data = teamSchema.parse(body);
    const { name, email, password, role, status, ...teamData } = data;

    const passwordHash = await bcrypt.hash(password, 10);

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

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          status,
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      });

      const team = await tx.team.create({
        data: {
          ...teamData,
          name,
          userId: user.id,
          franchiseId,
        },
        select: {
          id: true,
          name: true,
          joiningDate: true,
          leavingDate: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          pincode: true,
          userMobile: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true, status: true },
          },
        },
      });

      return team;
    });

    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Failed to create team:", error);
    const err = error as { code?: string; message?: string };
    if (err?.code === "P2002") return Error("Email already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for teams. Run Prisma migrate.", 500);
    if (
      error instanceof TypeError &&
      (String(error.message).includes("prisma.team") || String(error.message).includes("undefined"))
    ) {
      return Error(
        "Prisma client is out of date. Run prisma generate and restart dev server.",
        500
      );
    }
    return Error((err?.message as string) || "Failed to create team");
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }

  try {
    const { id, ...updateData } = body as { id: number | string; [key: string]: any };
    
    if (!id) {
      return BadRequest("Team id required");
    }

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

    const parsedData = teamSchema.partial().extend({
      password: z.string().min(8, "Password must be at least 8 characters").max(255, "Password must be less than 255 characters").optional(),
      addressLine1: z.string().min(1, "Address Line 1 is required").max(500, "Address Line 1 must be less than 500 characters").optional(),
      addressLine2: z.string().max(500, "Address Line 2 must be less than 500 characters").nullable().optional(),
      city: z.string().min(1, "City is required").max(100, "City must be less than 100 characters").optional(),
      state: z.string().min(1, "State is required").max(100, "State must be less than 100 characters").optional(),
      pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be exactly 6 digits").optional(),
      userMobile: z.string().regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits").optional(),
      email: z.string().email("Invalid email format").max(255, "Email must be less than 255 characters").optional(),
      name: z.string().min(1, "Team name is required").max(255, "Team name must be less than 255 characters").optional()
    }).parse(updateData);

    const { 
      name, email, password, status, role, 
      ...teamData 
    } = parsedData as {
      name?: string;
      email?: string;
      password?: string;
      status?: boolean;
      role?: 'FRANCHISE' | 'DOCTOR';
      [key: string]: any;
    };

    const data: Record<string, unknown> = {};
    
    // Handle user updates separately
    const userUpdates: Record<string, unknown> = {};
    if (name) userUpdates.name = name;
    if (email) userUpdates.email = email;
    if (password && password.trim().length > 0) userUpdates.passwordHash = await bcrypt.hash(password, 10);
    if (status !== undefined) userUpdates.status = status;
    if (role) userUpdates.role = role;

    if (Object.keys(userUpdates).length > 0) {
      data.user = { update: userUpdates };
    }

    // Add team data updates
    if (teamData.joiningDate) data.joiningDate = new Date(teamData.joiningDate);
    if (teamData.leavingDate) data.leavingDate = new Date(teamData.leavingDate);
    
    // Add other team fields
    Object.keys(teamData).forEach(key => {
      if (key !== 'joiningDate' && key !== 'leavingDate' && teamData[key as keyof typeof teamData] !== undefined) {
        data[key] = teamData[key as keyof typeof teamData];
      }
    });

    if (Object.keys(data).length === 0) {
      return BadRequest("Nothing to update");
    }

    // Verify the team belongs to the user's franchise
    const existingTeam = await prisma.team.findUnique({
      where: { id: Number(id) },
      select: { franchiseId: true }
    });

    if (!existingTeam) {
      return Error("Team not found", 404);
    }

    if (existingTeam.franchiseId !== franchiseId) {
      return Error("Team does not belong to your franchise", 403);
    }

    const updated = await prisma.team.update({
      where: { id: Number(id) },
      data:{
        ...data,
        name: name || undefined,
      },
      select: {
        id: true,
        name: true,
        joiningDate: true,
        leavingDate: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        userMobile: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Failed to update team:", error);
    const err = error as { code?: string; message?: string };
    if (err?.code === "P2025") return Error("Team not found", 404);
    if (err?.code === "P2002") return Error("Email already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for teams. Run Prisma migrate.", 500);
    if (
      error instanceof TypeError &&
      (String(error.message).includes("prisma.team") || String(error.message).includes("undefined"))
    ) {
      return Error(
        "Prisma client is out of date. Run prisma generate and restart dev server.",
        500
      );
    }
    return Error((err?.message as string) || "Failed to update team");
  }
}
