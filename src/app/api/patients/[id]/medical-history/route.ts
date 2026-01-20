import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

const medicationRowSchema = z.object({
  drug: z.string().optional().nullable(),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
});

const surgicalRowSchema = z.object({
  type: z.string().optional().nullable(),
  year: z.string().optional().nullable(),
});

const upsertSchema = z.object({
  reasonForVisit: z.string().optional().nullable(),
  heardAboutUs: z.string().optional().nullable(),
  pharmacyName: z.string().optional().nullable(),
  pharmacyLocation: z.string().optional().nullable(),

  diet: z.string().optional().nullable(),
  smokes: z.boolean().optional(),
  smokingUnitsPerDay: z.string().optional().nullable(),
  drinksAlcohol: z.boolean().optional(),
  alcoholHowMuch: z.string().optional().nullable(),
  alcoholFrequency: z.string().optional().nullable(),

  hasCurrentMedications: z.boolean().optional(),
  currentMedications: z.array(medicationRowSchema).optional().nullable(),
  hasMedicationAllergies: z.boolean().optional(),
  otherAllergies: z.string().optional().nullable(),

  hadAllergyTest: z.boolean().optional(),
  allergyTestDetails: z.string().optional().nullable(),

  medicalHistory: z.array(z.string()).optional().nullable(),
  medicalHistoryOther: z.string().optional().nullable(),

  hasSurgicalHistory: z.boolean().optional(),
  surgicalHistory: z.array(surgicalRowSchema).optional().nullable(),

  familyHistory: z.array(z.string()).optional().nullable(),
  familyHistoryOther: z.string().optional().nullable(),
});

function normalizeText(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function normalizeMedicationRows(
  rows: Array<{ drug?: string | null; dosage?: string | null; frequency?: string | null }> | null | undefined
) {
  if (!Array.isArray(rows)) return [];
  const normalized = rows
    .map((r) => ({
      drug: normalizeText(r?.drug),
      dosage: normalizeText(r?.dosage),
      frequency: normalizeText(r?.frequency),
    }))
    .filter((r) => r.drug || r.dosage || r.frequency);
  return normalized;
}

function normalizeSurgicalRows(
  rows: Array<{ type?: string | null; year?: string | null }> | null | undefined
) {
  if (!Array.isArray(rows)) return [];
  const normalized = rows
    .map((r) => ({
      type: normalizeText(r?.type),
      year: normalizeText(r?.year),
    }))
    .filter((r) => r.type || r.year);
  return normalized;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const patientId = Number(id);
  if (Number.isNaN(patientId)) return ApiError("Invalid id", 400);

  try {
    const patientModel = (prisma as any).patient;
    const medicalHistoryModel = (prisma as any).patientMedicalHistory;
    if (!patientModel || !medicalHistoryModel) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }

    const patient = await patientModel.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        patientNo: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        mobile: true,
        medicalHistory: {
          select: {
            id: true,
            patientId: true,
            reasonForVisit: true,
            heardAboutUs: true,
            pharmacyName: true,
            pharmacyLocation: true,
            diet: true,
            smokes: true,
            smokingUnitsPerDay: true,
            drinksAlcohol: true,
            alcoholHowMuch: true,
            alcoholFrequency: true,
            hasCurrentMedications: true,
            currentMedications: true,
            hasMedicationAllergies: true,
            otherAllergies: true,
            hadAllergyTest: true,
            allergyTestDetails: true,
            medicalHistory: true,
            medicalHistoryOther: true,
            hasSurgicalHistory: true,
            surgicalHistory: true,
            familyHistory: true,
            familyHistoryOther: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!patient) return ApiError("Patient not found", 404);

    const mh = patient.medicalHistory || null;
    const normalized = mh
      ? {
          ...mh,
          medicalHistory: Array.isArray(mh.medicalHistory) ? mh.medicalHistory : [],
          familyHistory: Array.isArray(mh.familyHistory) ? mh.familyHistory : [],
          currentMedications: Array.isArray(mh.currentMedications) ? mh.currentMedications : [],
          surgicalHistory: Array.isArray(mh.surgicalHistory) ? mh.surgicalHistory : [],
        }
      : null;

    return Success({ patient: { ...patient, medicalHistory: undefined }, medicalHistory: normalized });
  } catch (e: unknown) {
    console.error("Failed to fetch medical history:", e);
    return ApiError("Failed to fetch medical history");
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const patientId = Number(id);
  if (Number.isNaN(patientId)) return ApiError("Invalid id", 400);

  try {
    const patientModel = (prisma as any).patient;
    const medicalHistoryModel = (prisma as any).patientMedicalHistory;
    if (!patientModel || !medicalHistoryModel) {
      return ApiError(
        "Prisma client is out of date. Run prisma generate and restart the dev server.",
        500
      );
    }

    const exists = await patientModel.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!exists) return ApiError("Patient not found", 404);

    const body = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return BadRequest(parsed.error.issues);

    const v = parsed.data;

    const hasCurrentMedications = v.hasCurrentMedications ?? false;
    const smokes = v.smokes ?? false;
    const drinksAlcohol = v.drinksAlcohol ?? false;
    const hasMedicationAllergies = v.hasMedicationAllergies ?? false;
    const hadAllergyTest = v.hadAllergyTest ?? false;
    const hasSurgicalHistory = v.hasSurgicalHistory ?? false;

    const currentMedRows = normalizeMedicationRows(v.currentMedications);
    const surgicalRows = normalizeSurgicalRows(v.surgicalHistory);

    const medicalHistoryArr = Array.isArray(v.medicalHistory) ? v.medicalHistory : [];
    const familyHistoryArrRaw = Array.isArray(v.familyHistory) ? v.familyHistory : [];
    const familyHistoryArr = familyHistoryArrRaw.includes("NONE") ? ["NONE"] : familyHistoryArrRaw;

    const data = {
      patientId,
      reasonForVisit: normalizeText(v.reasonForVisit),
      heardAboutUs: normalizeText(v.heardAboutUs),
      pharmacyName: normalizeText(v.pharmacyName),
      pharmacyLocation: normalizeText(v.pharmacyLocation),

      diet: normalizeText(v.diet),
      smokes,
      smokingUnitsPerDay: smokes ? normalizeText(v.smokingUnitsPerDay) : null,
      drinksAlcohol,
      alcoholHowMuch: drinksAlcohol ? normalizeText(v.alcoholHowMuch) : null,
      alcoholFrequency: drinksAlcohol ? normalizeText(v.alcoholFrequency) : null,

      hasCurrentMedications,
      currentMedications: hasCurrentMedications ? (currentMedRows.length ? currentMedRows : null) : null,
      hasMedicationAllergies,
      otherAllergies: hasMedicationAllergies ? normalizeText(v.otherAllergies) : null,

      hadAllergyTest,
      allergyTestDetails: hadAllergyTest ? normalizeText(v.allergyTestDetails) : null,

      medicalHistory: medicalHistoryArr.length ? medicalHistoryArr : null,
      medicalHistoryOther: medicalHistoryArr.includes("OTHER") ? normalizeText(v.medicalHistoryOther) : null,

      hasSurgicalHistory,
      surgicalHistory: hasSurgicalHistory ? (surgicalRows.length ? surgicalRows : null) : null,

      familyHistory: familyHistoryArr.length ? familyHistoryArr : null,
      familyHistoryOther: familyHistoryArr.includes("OTHER") ? normalizeText(v.familyHistoryOther) : null,
    };

    const saved = await medicalHistoryModel.upsert({
      where: { patientId },
      create: data,
      update: data,
      select: {
        id: true,
        patientId: true,
        reasonForVisit: true,
        heardAboutUs: true,
        pharmacyName: true,
        pharmacyLocation: true,
        diet: true,
        smokes: true,
        smokingUnitsPerDay: true,
        drinksAlcohol: true,
        alcoholHowMuch: true,
        alcoholFrequency: true,
        hasCurrentMedications: true,
        currentMedications: true,
        hasMedicationAllergies: true,
        otherAllergies: true,
        hadAllergyTest: true,
        allergyTestDetails: true,
        medicalHistory: true,
        medicalHistoryOther: true,
        hasSurgicalHistory: true,
        surgicalHistory: true,
        familyHistory: true,
        familyHistoryOther: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success({
      ...saved,
      medicalHistory: Array.isArray(saved.medicalHistory) ? saved.medicalHistory : [],
      familyHistory: Array.isArray(saved.familyHistory) ? saved.familyHistory : [],
      currentMedications: Array.isArray(saved.currentMedications) ? saved.currentMedications : [],
      surgicalHistory: Array.isArray(saved.surgicalHistory) ? saved.surgicalHistory : [],
    });
  } catch (e: unknown) {
    console.error("Failed to upsert medical history:", e);
    const err = e as { code?: string };
    if (err?.code === "P2021") return ApiError("Database not migrated for medical history. Run Prisma migrate.", 500);
    return ApiError("Failed to save medical history");
  }
}
