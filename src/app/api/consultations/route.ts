import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { 
  createConsultationSchema, 
  updateConsultationSchema, 
  type CreateConsultationInput, 
  type UpdateConsultationInput 
} from '@/lib/schemas/backend/consultations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return Error("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return Error("Current user is not associated with any franchise", 400);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'createdAt';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const appointmentId = searchParams.get('appointmentId');
  const patientId = searchParams.get('patientId');

  const sortable = new Set(['createdAt', 'updatedAt', 'totalAmount', 'nextFollowUpDate']);
  const orderBy: Record<string, 'asc' | 'desc'> = sortable.has(sort)
    ? { [sort]: order }
    : { createdAt: 'desc' };

  const where: any = {
    appointment: {
      franchiseId,
    },
  };
  
  // Role-based filtering: DOCTOR can only see consultations from their team
  if (currentUser.role === 'DOCTOR' && currentUser.team) {
    where.appointment.teamId = currentUser.team.id;
  }
  
  if (search) {
    where.OR = [
      { complaint: { contains: search } },
      { diagnosis: { contains: search } },
      { remarks: { contains: search } },
    ];
  }
  
  if (appointmentId) {
    where.appointmentId = Number(appointmentId);
  }
  
  if (patientId) {
    where.appointment = {
      ...where.appointment,
      patientId: Number(patientId),
    };
  }

  try {
    const result = await paginate({
      model: prisma.consultation,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        appointmentId: true,
        complaint: true,
        diagnosis: true,
        remarks: true,
        casePaperUrl: true,
        nextFollowUpDate: true,
        totalAmount: true,
        totalReceivedAmount: true,
        createdAt: true,
        updatedAt: true,
        appointment: {
          select: {
            id: true,
            appointmentDateTime: true,
            visitPurpose: true,
            patient: {
              select: {
                id: true,
                patientNo: true,
                firstName: true,
                lastName: true,
                mobile: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consultationDetails: {
          select: {
            id: true,
            serviceId: true,
            description: true,
            qty: true,
            rate: true,
            amount: true,
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consultationMedicines: {
          select: {
            id: true,
            medicineId: true,
            qty: true,
            mrp: true,
            amount: true,
            doses: true,
            medicine: {
              select: {
                id: true,
                name: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return Success(result);
  } catch (e) {
    console.error('Error fetching consultations:', e);
    return Error('Failed to fetch consultations');
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const data = createConsultationSchema.parse(body) as CreateConsultationInput;

    // Check if consultation already exists for this appointment
    const existingConsultation = await prisma.consultation.findFirst({
      where: { appointmentId: data.appointmentId },
      select: { id: true },
    });
    if (existingConsultation) return Error('Consultation already exists for this appointment', 409);

    const created = await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.create({
        data: {
          appointmentId: data.appointmentId,
          complaint: data.complaint,
          diagnosis: data.diagnosis,
          remarks: data.remarks,
          casePaperUrl: data.casePaperUrl,
          nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null,
          totalAmount: data.totalAmount,
        },
        select: {
          id: true,
          appointmentId: true,
          complaint: true,
          diagnosis: true,
          remarks: true,
          casePaperUrl: true,
          nextFollowUpDate: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (data.consultationDetails && data.consultationDetails.length > 0) {
        await tx.consultationDetail.createMany({
          data: data.consultationDetails.map((d) => ({
            consultationId: consultation.id,
            serviceId: d.serviceId || null,
            description: d.description || null,
            qty: d.qty,
            rate: d.rate,
            amount: d.amount,
          })),
        });
      }

      if (data.consultationMedicines && data.consultationMedicines.length > 0) {
        await tx.consultationMedicine.createMany({
          data: data.consultationMedicines.map((m) => ({
            consultationId: consultation.id,
            medicineId: m.medicineId || null,
            qty: m.qty,
            mrp: m.mrp,
            amount: m.amount,
            doses: m.doses || null,
          })),
        });
      }

      // Create receipt if receipt data is provided and amount is greater than 0
      if (data.receipt && data.receipt.amount && data.receipt.amount > 0) {
        const receipt = await tx.consultationReceipt.create({
          data: {
            receiptNumber: '', // Will be auto-generated by middleware
            consultationId: consultation.id,
            date: data.receipt.date ? new Date(data.receipt.date) : new Date(),
            paymentMode: data.receipt.paymentMode || '',
            payerName: data.receipt.payerName || '',
            contactNumber: data.receipt.contactNumber || '',
            utrNumber: data.receipt.utrNumber || '',
            amount: data.receipt.amount,
            chequeNumber: data.receipt.chequeNumber || '',
            chequeDate: data.receipt.chequeDate ? new Date(data.receipt.chequeDate) : null,
            notes: data.receipt.notes || '',
            createdByUserId: auth.user.id,
          },
        });

        // Only update totalReceivedAmount if receipt was created successfully
        if (receipt) {
          // During consultation creation, totalReceivedAmount will always be NULL
          // So we can directly set it to the receipt amount
          await tx.consultation.update({
            where: { id: consultation.id },
            data: {
              totalReceivedAmount: data.receipt.amount
            }
          });
        }
      }

      return consultation;
    });

    return Success(created, 201);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Consultation already exists for this appointment', 409);
    if (err?.code === 'P2025') return Error('Appointment not found', 404);
    console.error('Create consultation error:', e);
    return Error('Failed to create consultation');
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error('Invalid JSON body', 400);
  }

  const { id, ...rest } = (body as Partial<{ id: number | string } & UpdateConsultationInput>) || {};
  if (!id) return Error('Consultation id required', 400);

  try {
    const parsed = updateConsultationSchema.parse(rest) as UpdateConsultationInput;

    const updated = await prisma.$transaction(async (tx) => {
      const data: any = {};
      if (parsed.complaint !== undefined) data.complaint = parsed.complaint;
      if (parsed.diagnosis !== undefined) data.diagnosis = parsed.diagnosis;
      if (parsed.remarks !== undefined) data.remarks = parsed.remarks;
      if (parsed.casePaperUrl !== undefined) data.casePaperUrl = parsed.casePaperUrl;
      if (parsed.nextFollowUpDate !== undefined) {
        data.nextFollowUpDate = parsed.nextFollowUpDate ? new Date(parsed.nextFollowUpDate) : null;
      }
      if (parsed.totalAmount !== undefined) data.totalAmount = parsed.totalAmount;

      const consultation = await tx.consultation.update({
        where: { id: Number(id) },
        data,
        select: {
          id: true,
          appointmentId: true,
          complaint: true,
          diagnosis: true,
          remarks: true,
          casePaperUrl: true,
          nextFollowUpDate: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (parsed.consultationDetails) {
        await tx.consultationDetail.deleteMany({ where: { consultationId: Number(id) } });
        if (parsed.consultationDetails.length) {
          await tx.consultationDetail.createMany({
            data: parsed.consultationDetails.map((d) => ({
              consultationId: Number(id),
              serviceId: d.serviceId || null,
              description: d.description || null,
              qty: d.qty!,
              rate: d.rate!,
              amount: d.amount!,
            })),
          });
        }
      }

      if (parsed.consultationMedicines) {
        await tx.consultationMedicine.deleteMany({ where: { consultationId: Number(id) } });
        if (parsed.consultationMedicines.length) {
          await tx.consultationMedicine.createMany({
            data: parsed.consultationMedicines.map((m) => ({
              consultationId: Number(id),
              medicineId: m.medicineId || null,
              qty: m.qty!,
              mrp: m.mrp!,
              amount: m.amount!,
              doses: m.doses || null,
            })),
          });
        }
      }

      return consultation;
    });

    return Success(updated);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Consultation not found', 404);
    if (err?.code === 'P2002') return Error('Consultation already exists for this appointment', 409);
    console.error('Update consultation error:', e);
    return Error('Failed to update consultation');
  }
}
