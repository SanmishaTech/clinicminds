import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
// Permissions resolved automatically via guardApiAccess rules
import bcrypt from "bcryptjs";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ACTIVE_ROLE_CODES, ROLES } from "@/config/roles";

// Normalize a possibly human label to a role code defined in ROLES
function labelToRoleCode(label?: string | null) {
  if (!label) return undefined as unknown as string;
  for (const [code, lbl] of Object.entries(ROLES)) {
    if (lbl === label) return code;
  }
  return label; // assume it's already a code
}

const ACTIVE_ROLE_SET = new Set((ACTIVE_ROLE_CODES as readonly string[]).map(String));

// GET /api/users?search=&role=&status=true|false&page=1&perPage=10&sort=createdAt&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(searchParams.get("perPage")) || 10)
  );
  const search = searchParams.get("search")?.trim() || "";
  const role = searchParams.get("role")?.trim() || "";
  const statusParam = searchParams.get("status");
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  // Build dynamic filter with explicit shape
  type UserWhere = {
    OR?: { name?: { contains: string }; email?: { contains: string } }[];
    role?: string;
    status?: boolean;
  };
  const where: UserWhere = {};
  if (search) {
    // Removed `mode: "insensitive"` for compatibility with current Prisma version / provider.
    // Case-insensitivity usually handled by DB collation (e.g., utf8mb4_general_ci in MySQL).
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  if (role) {
    const roleCode = labelToRoleCode(role);
    if (!ACTIVE_ROLE_SET.has(roleCode)) return Error("Invalid role", 400);
    where.role = roleCode as any;
  }
  if (statusParam === "true" || statusParam === "false")
    where.status = statusParam === "true";

  // Allow listed sortable fields only
  const sortableFields = new Set([
    "name",
    "email",
    "role",
    "status",
    "createdAt",
    "lastLogin",
  ]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  const result = await paginate({
    model: prisma.user,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
    },
  });
  return Success(result);
}

// POST /api/users  (create user)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const {
    name,
    email,
    password,
    role = "DOCTOR",
    status = true,
  } = (body as Partial<{
    name: string;
    email: string;
    password: string;
    role: string;
    status: boolean;
  }>) || {};
  if (!email || !password) return Error("Email & password required", 400);
  if (!role) return Error("Role required", 400);

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const roleCode = labelToRoleCode(role) as any;
    if (!ACTIVE_ROLE_SET.has(String(roleCode))) return Error("Invalid role", 400);
    const created = await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
        role: roleCode,
        status: Boolean(status),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return Error("Email already exists", 409);
    return Error("Failed to create user");
  }
}

// PATCH /api/users  { id, status? , role? , name? }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const { id, status, role, name, email, password } =
    (body as Partial<{
      id: number | string;
      status?: boolean;
      role?: string;
      name?: string;
      email?: string;
      password?: string;
    }>) || {};
  if (!id) return Error("User id required", 400);

  const data: Record<string, unknown> = {};
  if (typeof status === "boolean") data.status = status;
  if (typeof role === "string" && role) {
    const roleCode = labelToRoleCode(role);
    if (!ACTIVE_ROLE_SET.has(String(roleCode))) return Error("Invalid role", 400);
    data.role = roleCode;
  }
  if (typeof name === "string") data.name = name || null;
  if (typeof email === "string") {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return Error("Email required", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Error("Invalid email", 400);
    }
    data.email = normalizedEmail;
  }
  if (typeof password === "string") {
    const pw = password.trim();
    if (pw) {
      if (pw.length < 6) return Error("Password must be at least 6 characters", 400);
      const passwordHash = await bcrypt.hash(pw, 10);
      data.passwordHash = passwordHash;
    }
  }
  if (Object.keys(data).length === 0) return Error("Nothing to update", 400);

  try {
    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return Error("Email already exists", 409);
    if (err?.code === "P2025") return Error("User not found", 404);
    return Error("Failed to update user");
  }
}
