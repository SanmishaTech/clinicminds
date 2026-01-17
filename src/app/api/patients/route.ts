import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { MASTER_CONFIG } from "@/config/master";

function dateKeyUtc(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
}

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

type PatientListItem = {
  id: number;
  patientNo: string;
  team: string;
  name: string;
  gender: string;
  status: string;
  mobile1: string;
  createdAt: Date;
  state: { id: number; state: string };
  city: { id: number; city: string };
};

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const team = searchParams.get("team")?.trim() || "";
  const gender = searchParams.get("gender")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type PatientWhere = {
    OR?: { patientNo?: { contains: string }; name?: { contains: string }; mobile1?: { contains: string }; mobile2?: { contains: string }; email?: { contains: string } }[];
    team?: { contains: string };
    gender?: string;
    status?: { contains: string };
  };

  const where: PatientWhere = {};
  if (search) {
    where.OR = [
      { patientNo: { contains: search } },
      { name: { contains: search } },
      { mobile1: { contains: search } },
      { mobile2: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (team) where.team = { contains: team };
  if (gender) {
    const g = normalizeGender(gender);
    if (!g) return ApiError("Invalid gender", 400);
    where.gender = g;
  }
  if (status) where.status = { contains: status };

  const sortableFields = new Set(["patientNo", "team", "name", "gender", "status", "mobile1", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { createdAt: "desc" };

  try {
    const patientModel = (prisma as any).patient;
    if (!patientModel) return ApiError("Prisma client is out of date. Run prisma generate and restart the dev server.", 500);

    const result = await paginate<any, PatientWhere, PatientListItem>({
      model: patientModel,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        patientNo: true,
        team: true,
        name: true,
        gender: true,
        status: true,
        mobile1: true,
        createdAt: true,
        state: { select: { id: true, state: true } },
        city: { select: { id: true, city: true } },
      },
    });
    return Success(result);
  } catch (e: unknown) {
    console.error("Failed to list patients:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2021") return ApiError("Database not migrated for patients. Run Prisma migrate.", 500);
    return ApiError((err?.message as string) || "Failed to list patients");
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError("Invalid JSON body", 400);
  }

  const {
    team,
    name,
    dateOfBirth,
    age,
    gender,
    status = "Active",
    address,
    stateId,
    cityId,
    pincode,
    mobile1,
    mobile2,
    email,
    contactPerson,
    contactPersonRelation,
    contactPersonMobile1,
    contactPersonMobile2,
    balanceAmount,
  } =
    (body as Partial<{
      team: string;
      name: string;
      dateOfBirth?: string | null;
      age?: number | string | null;
      gender: string;
      status?: string;
      address?: string | null;
      stateId: number | string;
      cityId: number | string;
      pincode?: string | null;
      mobile1: string;
      mobile2?: string | null;
      email?: string | null;
      contactPerson?: string | null;
      contactPersonRelation?: string | null;
      contactPersonMobile1?: string | null;
      contactPersonMobile2?: string | null;
      balanceAmount?: number | string | null;
    }>) || {};

  if (!team) return ApiError("Team is required", 400);
  if (!name) return ApiError("Name is required", 400);
  if (age === undefined || age === null || age === "") return ApiError("Age is required", 400);
  if (!gender) return ApiError("Gender is required", 400);
  if (!stateId) return ApiError("State is required", 400);
  if (!cityId) return ApiError("City is required", 400);
  if (!mobile1) return ApiError("Mobile 1 is required", 400);

  const normalizedGender = normalizeGender(gender);
  if (!normalizedGender) return ApiError("Invalid gender", 400);

  const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;
  if (dateOfBirth && Number.isNaN(parsedDob?.getTime() as number)) return ApiError("Invalid date of birth", 400);

  const parsedAge = age === null || age === undefined || age === "" ? null : Number(age);
  if (parsedAge === null || Number.isNaN(parsedAge)) return ApiError("Invalid age", 400);
  if (parsedAge < 0) return ApiError("Invalid age", 400);

  const parsedBalance = balanceAmount === null || balanceAmount === undefined || balanceAmount === "" ? 0 : Number(balanceAmount);
  if (Number.isNaN(parsedBalance)) return ApiError("Invalid balance amount", 400);

  const statusText = typeof status === "string" ? status.trim() : "";
  const finalStatus = statusText || "Active";

  try {
    const patientModel = (prisma as any).patient;
    const seqModel = (prisma as any).patientSequence;
    if (!patientModel || !seqModel) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }

    const now = new Date();
    const dateKey = dateKeyUtc(now);

    const created = await prisma.$transaction(async (tx) => {
      // Validate city belongs to state
      const cityRow = await tx.city.findUnique({ where: { id: Number(cityId) }, select: { id: true, stateId: true } });
      if (!cityRow) throw new globalThis.Error("City not found");
      if (cityRow.stateId !== Number(stateId)) throw new globalThis.Error("City does not belong to selected state");

      const seq = await (tx as any).patientSequence.upsert({
        where: { dateKey },
        update: { lastNumber: { increment: 1 } },
        create: { dateKey, lastNumber: 1 },
        select: { lastNumber: true },
      });

      const patientNo = `P-${dateKey}-${String(seq.lastNumber).padStart(4, "0")}`;

      return (tx as any).patient.create({
        data: {
          patientNo,
          team: team.trim(),
          name: name.trim(),
          dateOfBirth: parsedDob,
          age: parsedAge,
          gender: normalizedGender,
          status: finalStatus,
          address: address || null,
          stateId: Number(stateId),
          cityId: Number(cityId),
          pincode: pincode || null,
          mobile1: mobile1.trim(),
          mobile2: mobile2 || null,
          email: email || null,
          contactPerson: contactPerson || null,
          contactPersonRelation: contactPersonRelation || null,
          contactPersonMobile1: contactPersonMobile1 || null,
          contactPersonMobile2: contactPersonMobile2 || null,
          balanceAmount: parsedBalance,
        },
        select: {
          id: true,
          patientNo: true,
          team: true,
          name: true,
          gender: true,
          status: true,
          mobile1: true,
          createdAt: true,
          state: { select: { id: true, state: true } },
          city: { select: { id: true, city: true } },
        },
      });
    });

    return Success(created, 201);
  } catch (e: unknown) {
    console.error("Failed to create patient:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2002") return ApiError("Patient already exists", 409);
    if (err?.code === "P2021") return ApiError("Database not migrated for patients. Run Prisma migrate.", 500);
    const msg = (err?.message as string) || "Failed to create patient";
    if (msg === "City not found") return ApiError("City not found", 404);
    if (msg === "City does not belong to selected state") return ApiError("City does not belong to selected state", 400);
    return ApiError(msg);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError("Invalid JSON body", 400);
  }

  const {
    id,
    team,
    name,
    dateOfBirth,
    age,
    gender,
    status,
    address,
    stateId,
    cityId,
    pincode,
    mobile1,
    mobile2,
    email,
    contactPerson,
    contactPersonRelation,
    contactPersonMobile1,
    contactPersonMobile2,
    balanceAmount,
  } =
    (body as Partial<{
      id: number | string;
      team?: string;
      name?: string;
      dateOfBirth?: string | null;
      age?: number | string | null;
      gender?: string;
      status?: string;
      address?: string | null;
      stateId?: number | string;
      cityId?: number | string;
      pincode?: string | null;
      mobile1?: string;
      mobile2?: string | null;
      email?: string | null;
      contactPerson?: string | null;
      contactPersonRelation?: string | null;
      contactPersonMobile1?: string | null;
      contactPersonMobile2?: string | null;
      balanceAmount?: number | string | null;
    }>) || {};

  if (!id) return ApiError("Patient id required", 400);

  const data: Record<string, unknown> = {};

  if (typeof team === "string") data.team = team.trim();
  if (typeof name === "string") data.name = name.trim();

  if (dateOfBirth !== undefined) {
    if (!dateOfBirth) data.dateOfBirth = null;
    else {
      const d = new Date(dateOfBirth);
      if (Number.isNaN(d.getTime())) return ApiError("Invalid date of birth", 400);
      data.dateOfBirth = d;
    }
  }

  if (age !== undefined) {
    if (age === null || age === "") return ApiError("Age is required", 400);
    const n = Number(age);
    if (Number.isNaN(n) || n < 0) return ApiError("Invalid age", 400);
    data.age = n;
  }

  if (gender !== undefined) {
    const g = normalizeGender(gender);
    if (!g) return ApiError("Invalid gender", 400);
    data.gender = g;
  }

  if (status !== undefined) {
    if (typeof status !== "string") return ApiError("Invalid status", 400);
    const s = status.trim();
    if (!s) return ApiError("Status is required", 400);
    data.status = s;
  }
  if (typeof address === "string" || address === null) data.address = address || null;
  if (typeof pincode === "string" || pincode === null) data.pincode = pincode || null;
  if (typeof mobile1 === "string") data.mobile1 = mobile1.trim();
  if (typeof mobile2 === "string" || mobile2 === null) data.mobile2 = mobile2 || null;
  if (typeof email === "string" || email === null) data.email = email || null;
  if (typeof contactPerson === "string" || contactPerson === null) data.contactPerson = contactPerson || null;
  if (typeof contactPersonRelation === "string" || contactPersonRelation === null) data.contactPersonRelation = contactPersonRelation || null;
  if (typeof contactPersonMobile1 === "string" || contactPersonMobile1 === null) data.contactPersonMobile1 = contactPersonMobile1 || null;
  if (typeof contactPersonMobile2 === "string" || contactPersonMobile2 === null) data.contactPersonMobile2 = contactPersonMobile2 || null;

  if (balanceAmount !== undefined) {
    if (balanceAmount === null || balanceAmount === "") data.balanceAmount = 0;
    else {
      const n = Number(balanceAmount);
      if (Number.isNaN(n)) return ApiError("Invalid balance amount", 400);
      data.balanceAmount = n;
    }
  }

  const nextStateId = stateId !== undefined ? Number(stateId) : undefined;
  const nextCityId = cityId !== undefined ? Number(cityId) : undefined;

  if (stateId !== undefined) {
    if (Number.isNaN(nextStateId)) return ApiError("Invalid state", 400);
    data.stateId = nextStateId;
  }
  if (cityId !== undefined) {
    if (Number.isNaN(nextCityId)) return ApiError("Invalid city", 400);
    data.cityId = nextCityId;
  }

  if (Object.keys(data).length === 0) return ApiError("Nothing to update", 400);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const effectiveStateId =
        (data.stateId as number | undefined) ??
        (await (tx as any).patient.findUnique({ where: { id: Number(id) }, select: { stateId: true } }))?.stateId;
      const effectiveCityId =
        (data.cityId as number | undefined) ??
        (await (tx as any).patient.findUnique({ where: { id: Number(id) }, select: { cityId: true } }))?.cityId;

      if (!effectiveStateId || !effectiveCityId) throw new globalThis.Error("Patient not found");

      // Validate city belongs to state when either changes
      if (stateId !== undefined || cityId !== undefined) {
        const cityRow = await tx.city.findUnique({ where: { id: effectiveCityId }, select: { id: true, stateId: true } });
        if (!cityRow) throw new globalThis.Error("City not found");
        if (cityRow.stateId !== effectiveStateId) throw new globalThis.Error("City does not belong to selected state");
      }

      return (tx as any).patient.update({
        where: { id: Number(id) },
        data,
        select: {
          id: true,
          patientNo: true,
          team: true,
          name: true,
          gender: true,
          status: true,
          mobile1: true,
          createdAt: true,
          state: { select: { id: true, state: true } },
          city: { select: { id: true, city: true } },
        },
      });
    });

    return Success(updated);
  } catch (e: unknown) {
    console.error("Failed to update patient:", e);
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2025") return ApiError("Patient not found", 404);
    const msg = (err?.message as string) || "Failed to update patient";
    if (msg === "Patient not found") return ApiError("Patient not found", 404);
    if (msg === "City not found") return ApiError("City not found", 404);
    if (msg === "City does not belong to selected state") return ApiError("City does not belong to selected state", 400);
    return ApiError(msg);
  }
}
