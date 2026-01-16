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

  type StateWhere = { state?: { contains: string } };
  const where: StateWhere = {};
  if (search) where.state = { contains: search };

  const sortableFields = new Set(["state", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  try {
    const result = await paginate({
      model: prisma.state,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        state: true,
        createdAt: true,
      },
    });
    return Success(result);
  } catch (e: unknown) {
    console.error("Failed to list states:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2021") return Error("Database not migrated for states. Run Prisma migrate.", 500);
    return Error((err?.message as string) || "Failed to list states");
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

  const { state } = (body as Partial<{ state: string }>) || {};
  if (!state) return Error("State is required", 400);

  try {
    const created = await prisma.state.create({
      data: { state: state.trim() },
      select: { id: true, state: true, createdAt: true },
    });
    return Success(created, 201);
  } catch (e: unknown) {
    console.error("Failed to create state:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2002") return Error("State already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for states. Run Prisma migrate.", 500);
    return Error((err?.message as string) || "Failed to create state");
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

  const { id, state } = (body as Partial<{ id: number | string; state: string }>) || {};
  if (!id) return Error("State id required", 400);
  if (!state) return Error("State is required", 400);

  try {
    const updated = await prisma.state.update({
      where: { id: Number(id) },
      data: { state: state.trim() },
      select: { id: true, state: true, createdAt: true },
    });
    return Success(updated);
  } catch (e: unknown) {
    console.error("Failed to update state:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2025") return Error("State not found", 404);
    if (err?.code === "P2002") return Error("State already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for states. Run Prisma migrate.", 500);
    return Error((err?.message as string) || "Failed to update state");
  }
}
