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
  team: { id: number; name: string } | null;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  mobile: string;
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
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const where: any = {};
  if (search) {
    where.OR = [
      { patientNo: { contains: search } },
      { firstName: { contains: search } },
      { middleName: { contains: search } },
      { lastName: { contains: search } },
      { mobile: { contains: search } },
      { email: { contains: search } },
      { aadharNo: { contains: search } },
    ];
  }
  if (team) where.team = { is: { name: { contains: team } } };
  if (gender) {
    const g = normalizeGender(gender);
    if (!g) return ApiError("Invalid gender", 400);
    where.gender = g;
  }

  const sortableFields = new Set(["patientNo", "firstName", "gender", "mobile", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { createdAt: "desc" };

  try {
    const patientModel = (prisma as any).patient;
    if (!patientModel) return ApiError("Prisma client is out of date. Run prisma generate and restart the dev server.", 500);

    const result = await paginate<any, any, PatientListItem>({
      model: patientModel,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        patientNo: true,
        team: { select: { id: true, name: true } },
        firstName: true,
        middleName: true,
        lastName: true,
        gender: true,
        mobile: true,
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
    franchiseId,
    teamId,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    age,
    gender,
    bloodGroup,
    height,
    weight,
    bmi,
    address,
    stateId,
    cityId,
    pincode,
    email,
    mobile,
    aadharNo,
    occupation,
    maritalStatus,
    contactPersonName,
    contactPersonRelation,
    contactPersonAddress,
    contactPersonMobile,
    contactPersonEmail,
    medicalInsurance,
    primaryInsuranceName,
    primaryInsuranceHolderName,
    primaryInsuranceId,
    secondaryInsuranceName,
    secondaryInsuranceHolderName,
    secondaryInsuranceId,
    balanceAmount,
  } =
    (body as Partial<{
      franchiseId?: number | string | null;
      teamId?: number | string | null;
      firstName: string;
      middleName: string;
      lastName: string;
      dateOfBirth?: string | null;
      age?: number | string | null;
      gender: string;
      bloodGroup: string;
      height?: string | null;
      weight?: string | null;
      bmi?: string | null;
      address: string;
      stateId: number | string;
      cityId: number | string;
      pincode?: string | null;
      email?: string | null;
      mobile: string;
      aadharNo: string;
      occupation?: string | null;
      maritalStatus?: string | null;
      contactPersonName?: string | null;
      contactPersonRelation?: string | null;
      contactPersonAddress?: string | null;
      contactPersonMobile?: string | null;
      contactPersonEmail?: string | null;
      medicalInsurance?: boolean | string | null;
      primaryInsuranceName?: string | null;
      primaryInsuranceHolderName?: string | null;
      primaryInsuranceId?: string | null;
      secondaryInsuranceName?: string | null;
      secondaryInsuranceHolderName?: string | null;
      secondaryInsuranceId?: string | null;
      balanceAmount?: number | string | null;
    }>) || {};

  if (!firstName) return ApiError("First name is required", 400);
  if (!middleName) return ApiError("Middle name is required", 400);
  if (!lastName) return ApiError("Last name is required", 400);
  if (!gender) return ApiError("Gender is required", 400);
  if (!bloodGroup) return ApiError("Blood group is required", 400);
  if (!address) return ApiError("Address is required", 400);
  if (!stateId) return ApiError("State is required", 400);
  if (!cityId) return ApiError("City is required", 400);
  if (!mobile) return ApiError("Mobile is required", 400);
  if (!aadharNo) return ApiError("Aadhar No is required", 400);

  if (!/^[0-9]{10}$/.test(String(mobile).trim())) return ApiError("Mobile must be 10 digits", 400);
  if (!/^[0-9]{12}$/.test(String(aadharNo).trim())) return ApiError("Aadhar No must be 12 digits", 400);
  if (contactPersonMobile && !/^[0-9]{10}$/.test(String(contactPersonMobile).trim())) return ApiError("Contact Person Mobile must be 10 digits", 400);

  const normalizedGender = normalizeGender(gender);
  if (!normalizedGender) return ApiError("Invalid gender", 400);

  const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;
  if (dateOfBirth && Number.isNaN(parsedDob?.getTime() as number)) return ApiError("Invalid date of birth", 400);

  const parsedAge = age === null || age === undefined || age === "" ? null : Number(age);
  if (parsedAge !== null) {
    if (Number.isNaN(parsedAge)) return ApiError("Invalid age", 400);
    if (parsedAge < 0) return ApiError("Invalid age", 400);
  }

  const parsedBalance = balanceAmount === null || balanceAmount === undefined || balanceAmount === "" ? 0 : Number(balanceAmount);
  if (Number.isNaN(parsedBalance)) return ApiError("Invalid balance amount", 400);

  const parsedFranchiseId = franchiseId === null || franchiseId === undefined || franchiseId === "" ? null : Number(franchiseId);
  if (parsedFranchiseId !== null && Number.isNaN(parsedFranchiseId)) return ApiError("Invalid franchise", 400);

  const parsedTeamId = teamId === null || teamId === undefined || teamId === "" ? null : Number(teamId);
  if (parsedTeamId !== null && Number.isNaN(parsedTeamId)) return ApiError("Invalid team", 400);

  const parsedMedicalInsurance =
    medicalInsurance === true || medicalInsurance === "true"
      ? true
      : medicalInsurance === false || medicalInsurance === "false"
        ? false
        : undefined;

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
          franchiseId: parsedFranchiseId,
          teamId: parsedTeamId,
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: parsedDob,
          age: parsedAge,
          gender: normalizedGender,
          bloodGroup: bloodGroup.trim(),
          height: typeof height === "string" ? height : null,
          weight: typeof weight === "string" ? weight : null,
          bmi: typeof bmi === "string" ? bmi : null,
          address: address.trim(),
          stateId: Number(stateId),
          cityId: Number(cityId),
          pincode: pincode || null,
          mobile: mobile.trim(),
          email: email || null,
          aadharNo: aadharNo.trim(),
          occupation: occupation || null,
          maritalStatus: maritalStatus || null,
          contactPersonName: contactPersonName || null,
          contactPersonRelation: contactPersonRelation || null,
          contactPersonAddress: contactPersonAddress || null,
          contactPersonMobile: contactPersonMobile || null,
          contactPersonEmail: contactPersonEmail || null,
          medicalInsurance: parsedMedicalInsurance ?? false,
          primaryInsuranceName: primaryInsuranceName || null,
          primaryInsuranceHolderName: primaryInsuranceHolderName || null,
          primaryInsuranceId: primaryInsuranceId || null,
          secondaryInsuranceName: secondaryInsuranceName || null,
          secondaryInsuranceHolderName: secondaryInsuranceHolderName || null,
          secondaryInsuranceId: secondaryInsuranceId || null,
          balanceAmount: parsedBalance,
        },
        select: {
          id: true,
          patientNo: true,
          team: { select: { id: true, name: true } },
          firstName: true,
          middleName: true,
          lastName: true,
          gender: true,
          mobile: true,
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
    franchiseId,
    teamId,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    age,
    gender,
    bloodGroup,
    height,
    weight,
    bmi,
    address,
    stateId,
    cityId,
    pincode,
    email,
    mobile,
    aadharNo,
    occupation,
    maritalStatus,
    contactPersonName,
    contactPersonRelation,
    contactPersonAddress,
    contactPersonMobile,
    contactPersonEmail,
    medicalInsurance,
    primaryInsuranceName,
    primaryInsuranceHolderName,
    primaryInsuranceId,
    secondaryInsuranceName,
    secondaryInsuranceHolderName,
    secondaryInsuranceId,
    balanceAmount,
  } =
    (body as Partial<{
      id: number | string;
      franchiseId?: number | string | null;
      teamId?: number | string | null;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      dateOfBirth?: string | null;
      age?: number | string | null;
      gender?: string;
      bloodGroup?: string;
      height?: string | null;
      weight?: string | null;
      bmi?: string | null;
      address?: string;
      stateId?: number | string;
      cityId?: number | string;
      pincode?: string | null;
      email?: string | null;
      mobile?: string;
      aadharNo?: string;
      occupation?: string | null;
      maritalStatus?: string | null;
      contactPersonName?: string | null;
      contactPersonRelation?: string | null;
      contactPersonAddress?: string | null;
      contactPersonMobile?: string | null;
      contactPersonEmail?: string | null;
      medicalInsurance?: boolean | string | null;
      primaryInsuranceName?: string | null;
      primaryInsuranceHolderName?: string | null;
      primaryInsuranceId?: string | null;
      secondaryInsuranceName?: string | null;
      secondaryInsuranceHolderName?: string | null;
      secondaryInsuranceId?: string | null;
      balanceAmount?: number | string | null;
    }>) || {};

  if (!id) return ApiError("Patient id required", 400);

  const data: Record<string, unknown> = {};

  if (franchiseId !== undefined) {
    if (franchiseId === null || franchiseId === "") data.franchiseId = null;
    else {
      const n = Number(franchiseId);
      if (Number.isNaN(n)) return ApiError("Invalid franchise", 400);
      data.franchiseId = n;
    }
  }

  if (teamId !== undefined) {
    if (teamId === null || teamId === "") data.teamId = null;
    else {
      const n = Number(teamId);
      if (Number.isNaN(n)) return ApiError("Invalid team", 400);
      data.teamId = n;
    }
  }

  if (typeof firstName === "string") {
    const v = firstName.trim();
    if (!v) return ApiError("First name is required", 400);
    data.firstName = v;
  }
  if (typeof middleName === "string") {
    const v = middleName.trim();
    if (!v) return ApiError("Middle name is required", 400);
    data.middleName = v;
  }
  if (typeof lastName === "string") {
    const v = lastName.trim();
    if (!v) return ApiError("Last name is required", 400);
    data.lastName = v;
  }

  if (dateOfBirth !== undefined) {
    if (!dateOfBirth) data.dateOfBirth = null;
    else {
      const d = new Date(dateOfBirth);
      if (Number.isNaN(d.getTime())) return ApiError("Invalid date of birth", 400);
      data.dateOfBirth = d;
    }
  }

  if (age !== undefined) {
    if (age === null || age === "") data.age = null;
    else {
      const n = Number(age);
      if (Number.isNaN(n) || n < 0) return ApiError("Invalid age", 400);
      data.age = n;
    }
  }

  if (gender !== undefined) {
    const g = normalizeGender(gender);
    if (!g) return ApiError("Invalid gender", 400);
    data.gender = g;
  }

  if (typeof bloodGroup === "string") {
    const v = bloodGroup.trim();
    if (!v) return ApiError("Blood group is required", 400);
    data.bloodGroup = v;
  }
  if (typeof height === "string" || height === null) data.height = height || null;
  if (typeof weight === "string" || weight === null) data.weight = weight || null;
  if (typeof bmi === "string" || bmi === null) data.bmi = bmi || null;
  if (typeof address === "string") {
    const v = address.trim();
    if (!v) return ApiError("Address is required", 400);
    data.address = v;
  }
  if (typeof pincode === "string" || pincode === null) data.pincode = pincode || null;
  if (typeof mobile === "string") {
    const m = mobile.trim();
    if (!/^[0-9]{10}$/.test(m)) return ApiError("Mobile must be 10 digits", 400);
    data.mobile = m;
  }
  if (typeof email === "string" || email === null) data.email = email || null;
  if (typeof aadharNo === "string") {
    const a = aadharNo.trim();
    if (!/^[0-9]{12}$/.test(a)) return ApiError("Aadhar No must be 12 digits", 400);
    data.aadharNo = a;
  }
  if (typeof occupation === "string" || occupation === null) data.occupation = occupation || null;
  if (typeof maritalStatus === "string" || maritalStatus === null) data.maritalStatus = maritalStatus || null;
  if (typeof contactPersonName === "string" || contactPersonName === null) data.contactPersonName = contactPersonName || null;
  if (typeof contactPersonRelation === "string" || contactPersonRelation === null) data.contactPersonRelation = contactPersonRelation || null;
  if (typeof contactPersonAddress === "string" || contactPersonAddress === null) data.contactPersonAddress = contactPersonAddress || null;
  if (typeof contactPersonMobile === "string" || contactPersonMobile === null) {
    if (!contactPersonMobile) data.contactPersonMobile = null;
    else {
      const m = contactPersonMobile.trim();
      if (!/^[0-9]{10}$/.test(m)) return ApiError("Contact Person Mobile must be 10 digits", 400);
      data.contactPersonMobile = m;
    }
  }
  if (typeof contactPersonEmail === "string" || contactPersonEmail === null) data.contactPersonEmail = contactPersonEmail || null;

  if (medicalInsurance !== undefined) {
    if (medicalInsurance === null || medicalInsurance === "") data.medicalInsurance = false;
    else if (medicalInsurance === true || medicalInsurance === "true") data.medicalInsurance = true;
    else if (medicalInsurance === false || medicalInsurance === "false") data.medicalInsurance = false;
    else return ApiError("Invalid medical insurance", 400);
  }
  if (typeof primaryInsuranceName === "string" || primaryInsuranceName === null) data.primaryInsuranceName = primaryInsuranceName || null;
  if (typeof primaryInsuranceHolderName === "string" || primaryInsuranceHolderName === null)
    data.primaryInsuranceHolderName = primaryInsuranceHolderName || null;
  if (typeof primaryInsuranceId === "string" || primaryInsuranceId === null) data.primaryInsuranceId = primaryInsuranceId || null;
  if (typeof secondaryInsuranceName === "string" || secondaryInsuranceName === null) data.secondaryInsuranceName = secondaryInsuranceName || null;
  if (typeof secondaryInsuranceHolderName === "string" || secondaryInsuranceHolderName === null)
    data.secondaryInsuranceHolderName = secondaryInsuranceHolderName || null;
  if (typeof secondaryInsuranceId === "string" || secondaryInsuranceId === null) data.secondaryInsuranceId = secondaryInsuranceId || null;

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
          team: { select: { id: true, name: true } },
          firstName: true,
          middleName: true,
          lastName: true,
          gender: true,
          mobile: true,
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
