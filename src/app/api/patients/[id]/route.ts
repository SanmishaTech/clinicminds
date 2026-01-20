import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/patients/:id
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError("Invalid id", 400);

  try {
    const patientModel = (prisma as any).patient;
    if (!patientModel) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }
    const patient = await patientModel.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        patientNo: true,
        franchiseId: true,
        teamId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        age: true,
        gender: true,
        bloodGroup: true,
        height: true,
        weight: true,
        bmi: true,
        address: true,
        stateId: true,
        cityId: true,
        pincode: true,
        mobile: true,
        email: true,
        aadharNo: true,
        occupation: true,
        maritalStatus: true,
        contactPersonName: true,
        contactPersonRelation: true,
        contactPersonAddress: true,
        contactPersonMobile: true,
        contactPersonEmail: true,
        medicalInsurance: true,
        primaryInsuranceName: true,
        primaryInsuranceHolderName: true,
        primaryInsuranceId: true,
        secondaryInsuranceName: true,
        secondaryInsuranceHolderName: true,
        secondaryInsuranceId: true,
        balanceAmount: true,
        franchise: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        state: { select: { id: true, state: true } },
        city: { select: { id: true, city: true } },
      },
    });
    if (!patient) return ApiError("Patient not found", 404);
    return Success(patient);
  } catch (e: unknown) {
    console.error("Failed to fetch patient:", e);
    return ApiError("Failed to fetch patient");
  }
}

// DELETE /api/patients/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError("Invalid id", 400);

  try {
    const patientModel = (prisma as any).patient;
    if (!patientModel) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }
    await patientModel.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    console.error("Failed to delete patient:", e);
    const err = e as { code?: string };
    if (err?.code === "P2025") return ApiError("Patient not found", 404);
    if (err?.code === "P2021") return ApiError("Database not migrated for patients. Run Prisma migrate.", 500);
    return ApiError("Failed to delete patient");
  }
}
