import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { Success, Error, Unauthorized, BadRequest } from "@/lib/api-response";
import { z } from "zod";
import bcrypt from "bcryptjs";

const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be less than 255 characters"),
  email: z.string().email("Invalid email format").max(255, "Email must be less than 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(255, "Password must be less than 255 characters").optional(),
});

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;

  if (!accessToken) {
    return Unauthorized("No access token provided");
  }

  try {
    const decoded = await verifyAccessToken<{ sub: string }>(accessToken);
    const userId = decoded.sub;

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhoto: true,
        status: true,
        lastLogin: true,
      },
    });

    if (!user) {
      return Error("User not found", 404);
    }

    return Success(user);
  } catch (err) {
    console.error("Me endpoint error:", err);
    // This will catch expired tokens, invalid tokens, etc.
    return Unauthorized("Invalid access token");
  }
}

export async function PATCH(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;

  if (!accessToken) {
    return Unauthorized("No access token provided");
  }

  try {
    const decoded = await verifyAccessToken<{ sub: string }>(accessToken);
    const userId = decoded.sub;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Error("Invalid JSON body", 400);
    }

    const validatedData = profileUpdateSchema.parse(body);

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        NOT: {
          id: Number(userId)
        }
      }
    });

    if (existingUser) {
      return Error("Email already exists", 409);
    }

    const updateData: any = {
      name: validatedData.name.trim(),
      email: validatedData.email.trim().toLowerCase(),
    };

    if (validatedData.password && validatedData.password.trim().length > 0) {
      updateData.passwordHash = await bcrypt.hash(validatedData.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhoto: true,
        status: true,
        lastLogin: true,
      },
    });

    return Success(updatedUser);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return BadRequest(err.errors);
    }
    console.error("Profile update error:", err);
    const error = err as { code?: string; message?: string };
    if (error?.code === "P2025") {
      return Error("User not found", 404);
    }
    if (error?.code === "P2002") {
      return Error("Email already exists", 409);
    }
    return Error((error?.message as string) || "Failed to update profile");
  }
}
