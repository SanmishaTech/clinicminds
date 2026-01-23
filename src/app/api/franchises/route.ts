import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import bcrypt from "bcryptjs";

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

  type FranchiseWhere = {
    OR?: (
      | { name?: { contains: string } }
      | { city?: { contains: string } }
      | { state?: { contains: string } }
      | { pincode?: { contains: string } }
      | { contactNo?: { contains: string } }
      | { contactEmail?: { contains: string } }
      | { user?: { is: { email?: { contains: string } } } }
    )[];
    user?: { is: { status?: boolean } };
  };

  const where: FranchiseWhere = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { city: { contains: search } },
      { state: { contains: search } },
      { pincode: { contains: search } },
      { contactNo: { contains: search } },
      { contactEmail: { contains: search } },
      { user: { is: { email: { contains: search } } } },
    ];
  }

  if (statusParam === "true" || statusParam === "false") {
    where.user = { is: { status: statusParam === "true" } };
  }

  const sortableFields = new Set(["name", "city", "state", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  const result = await paginate({
    model: prisma.franchise,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      name: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      pincode: true,
      contactNo: true,
      contactEmail: true,
      franchiseFeeAmount: true,
      userMobile: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
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

  const {
    name,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    contactNo,
    contactEmail,
    franchiseFeeAmount,
    userName,
    userMobile,
    userEmail,
    password,
    status = true,
  } = (body as Partial<{
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    contactNo: string;
    contactEmail: string;
    franchiseFeeAmount: number;
    userName: string;
    userMobile: string;
    userEmail: string;
    password: string;
    status: boolean;
  }>) || {};

  if (!name) return Error("Franchise Name is required", 400);
  if (String(name).trim() === "") return Error("Franchise Name is required", 400);
  if (!addressLine1) return Error("Address Line 1 is required", 400);
  if (!city) return Error("City is required", 400);
  if (!state) return Error("State is required", 400);
  if (!pincode) return Error("Pincode is required", 400);
  if (!contactNo) return Error("Contact No is required", 400);
  if (!contactEmail) return Error("Contact Email is required", 400);

  if (!userName || String(userName).trim() === "") return Error("Name is required", 400);

  if (!userEmail || !password) return Error("Email & password required", 400);
  if (!userMobile) return Error("Mobile is required", 400);
  if (!/^[0-9]{10}$/.test(String(contactNo))) return Error("Contact No must be 10 digits", 400);
  if (!/^[0-9]{10}$/.test(String(userMobile))) return Error("Mobile must be 10 digits", 400);
  if (password.length < 6) return Error("Password must be at least 6 characters", 400);

  const trimmedFranchiseName = String(name).trim();

  try {
    const existingFranchiseByName = await prisma.franchise.findFirst({
      where: { name: trimmedFranchiseName },
      select: { id: true },
    });
    if (existingFranchiseByName) return Error("Franchise name already exists", 409);

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: String(userName).trim(),
          email: userEmail,
          passwordHash,
          role: "FRANCHISE",
          status: Boolean(status),
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      });

      const franchise = await tx.franchise.create({
        data: {
          name: trimmedFranchiseName,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
          city,
          state,
          pincode,
          contactNo,
          contactEmail,
          franchiseFeeAmount: typeof franchiseFeeAmount === 'number' ? franchiseFeeAmount : undefined,
          userMobile,
          userId: user.id,
        },
        select: {
          id: true,
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          pincode: true,
          contactNo: true,
          contactEmail: true,
          franchiseFeeAmount: true,
          userMobile: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, status: true },
          },
        },
      });

      return franchise;
    });

    return Success(created, 201);
  } catch (e: unknown) {
    console.error("Failed to create franchise:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2002") return Error("Email already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for franchises. Run Prisma migrate.", 500);
    if (
      e instanceof TypeError &&
      (String(e.message).includes("prisma.franchise") || String(e.message).includes("undefined"))
    ) {
      return Error(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }
    return Error((err?.message as string) || "Failed to create franchise");
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

  const {
    id,
    name,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    contactNo,
    contactEmail,
    franchiseFeeAmount,
    userName,
    userMobile,
    userEmail,
    password,
    status,
  } = (body as Partial<{
    id: number | string;
    name?: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
    contactNo?: string;
    contactEmail?: string;
    franchiseFeeAmount?: number;
    userName?: string;
    userMobile?: string;
    userEmail?: string;
    password?: string;
    status?: boolean;
  }>) || {};

  if (!id) return Error("Franchise id required", 400);

  const franchiseData: Record<string, unknown> = {};
  let desiredFranchiseName: string | undefined;
  if (typeof name === "string") {
    const trimmed = name.trim();
    if (trimmed === "") return Error("Franchise Name is required", 400);
    desiredFranchiseName = trimmed;
    franchiseData.name = trimmed;
  }
  if (typeof addressLine1 === "string" || addressLine1 === null) {
    if (!addressLine1 || (typeof addressLine1 === "string" && addressLine1.trim() === "")) {
      return Error("Address Line 1 is required", 400);
    }
    franchiseData.addressLine1 = addressLine1;
  }
  if (typeof addressLine2 === "string" || addressLine2 === null) franchiseData.addressLine2 = addressLine2 || null;
  if (typeof city === "string" && city) franchiseData.city = city;
  if (typeof state === "string" && state) franchiseData.state = state;
  if (typeof pincode === "string" && pincode) franchiseData.pincode = pincode;
  if (typeof contactNo === "string" && contactNo) {
    if (!/^[0-9]{10}$/.test(contactNo)) return Error("Contact No must be 10 digits", 400);
    franchiseData.contactNo = contactNo;
  }
  if (typeof contactEmail === "string" && contactEmail) franchiseData.contactEmail = contactEmail;
  if (typeof franchiseFeeAmount === 'number') franchiseData.franchiseFeeAmount = franchiseFeeAmount;
  if (typeof userMobile === "string" && userMobile) {
    if (!/^[0-9]{10}$/.test(userMobile)) return Error("Mobile must be 10 digits", 400);
    franchiseData.userMobile = userMobile;
  }

  const userData: Record<string, unknown> = {};
  if (typeof userName === "string") {
    if (userName.trim() === "") return Error("Name is required", 400);
    userData.name = userName.trim();
  }
  if (typeof userEmail === "string" && userEmail) userData.email = userEmail;
  if (typeof status === "boolean") userData.status = status;
  if (typeof password === "string" && password) {
    if (password.length < 8) return Error("Password must be at least 8 characters", 400);
    userData.passwordHash = await bcrypt.hash(password, 10);
  }

  const data: Record<string, unknown> = { ...franchiseData };
  if (Object.keys(userData).length) {
    data.user = { update: userData };
  }

  if (Object.keys(data).length === 0) return Error("Nothing to update", 400);

  try {
    if (desiredFranchiseName) {
      const existingFranchiseByName = await prisma.franchise.findFirst({
        where: { name: desiredFranchiseName, NOT: { id: Number(id) } },
        select: { id: true },
      });
      if (existingFranchiseByName) return Error("Franchise name already exists", 409);
    }

    const updated = await prisma.franchise.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        contactNo: true,
        contactEmail: true,
        franchiseFeeAmount: true,
        userMobile: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });
    return Success(updated);
  } catch (e: unknown) {
    console.error("Failed to update franchise:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2025") return Error("Franchise not found", 404);
    if (err?.code === "P2002") return Error("Email already exists", 409);
    if (err?.code === "P2021") return Error("Database not migrated for franchises. Run Prisma migrate.", 500);
    if (
      e instanceof TypeError &&
      (String(e.message).includes("prisma.franchise") || String(e.message).includes("undefined"))
    ) {
      return Error(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }
    return Error((err?.message as string) || "Failed to update franchise");
  }
}
