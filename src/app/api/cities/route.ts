import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const where = (search
    ? {
        OR: [
          { city: { contains: search } },
          { state: { is: { state: { contains: search } } } },
        ],
      }
    : {}) as any;

  const sortableFields = new Set(["city", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  try {
    const result = await paginate({
      model: prisma.city,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        city: true,
        stateId: true,
        createdAt: true,
        state: {
          select: {
            id: true,
            state: true,
          },
        },
      },
    });
    return Success(result);
  } catch (e: unknown) {
    console.error("Failed to list cities:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2021") return Error("Database not migrated for cities. Run Prisma migrate.", 500);
    return Error((err?.message as string) || "Failed to list cities");
  }
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

  const { city, stateId } = (body as Partial<{ city: string; stateId: number | string }>) || {};
  if (!city) return Error("City is required", 400);
  if (!stateId) return Error("State is required", 400);

  try {
    const created = await prisma.city.create({
      data: {
        city: city.trim(),
        stateId: Number(stateId),
      },
      select: {
        id: true,
        city: true,
        stateId: true,
        createdAt: true,
        state: { select: { id: true, state: true } },
      },
    });
    return Success(created, 201);
  } catch (e: unknown) {
    console.error("Failed to create city:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2002") return Error("City already exists in this state", 409);
    if (err?.code === "P2021") return Error("Database not migrated for cities. Run Prisma migrate.", 500);
    return Error((err?.message as string) || "Failed to create city");
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

  const { id, city, stateId } = (body as Partial<{ id: number | string; city: string; stateId: number | string }>) || {};
  if (!id) return Error("City id required", 400);
  if (!city) return Error("City is required", 400);
  if (!stateId) return Error("State is required", 400);

  try {
    const updated = await prisma.city.update({
      where: { id: Number(id) },
      data: {
        city: city.trim(),
        stateId: Number(stateId),
      },
      select: {
        id: true,
        city: true,
        stateId: true,
        createdAt: true,
        state: { select: { id: true, state: true } },
      },
    });
    return Success(updated);
  } catch (e: unknown) {
    console.error("Failed to update city:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2025") return Error("City not found", 404);
    if (err?.code === "P2002") return Error("City already exists in this state", 409);
    if (err?.code === "P2021") return Error("Database not migrated for cities. Run Prisma migrate.", 500);
    return Error((err?.message as string) || "Failed to update city");
  }
}
