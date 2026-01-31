import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';

const createPaymentSchema = z.object({
  paymentDate: z.string().datetime(),
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'CHEQUE']),
  payerName: z.string().trim().optional().nullable(),
  contactNumber: z.string().trim().optional().nullable(),
  utrNumber: z.string().trim().optional().nullable(),
  chequeDate: z.string().datetime().optional().nullable(),
  chequeNumber: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).superRefine((val, ctx) => {
  const payerName = val.payerName?.trim() || '';

  if (!payerName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payerName'], message: 'Name is required' });
  }

  if (val.paymentMode === 'CASH') {
    const cn = val.contactNumber?.trim() || '';
    if (!cn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactNumber'], message: 'Contact number is required' });
    } else if (!/^[0-9]{10}$/.test(cn)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactNumber'], message: 'Contact number must be 10 digits' });
    }
  }

  if (val.paymentMode === 'UPI') {
    const utr = val.utrNumber?.trim() || '';
    if (!utr) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['utrNumber'], message: 'UTR number is required' });
    }
  }

  if (val.paymentMode === 'CHEQUE') {
    const chequeDate = val.chequeDate?.trim() || '';
    if (!chequeDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chequeDate'], message: 'Cheque date is required' });
    }
    const chq = val.chequeNumber?.trim() || '';
    if (!chq) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chequeNumber'], message: 'Cheque number is required' });
    }
  }
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid id');

  try {
    const franchise = await prisma.franchise.findUnique({
      where: { id: idNum },
      select: { id: true, name: true, franchiseFeeAmount: true },
    });
    if (!franchise) return NotFound('Franchise not found');

    const paymentModel = (prisma as any).franchiseFeePayment;
    const payments = await paymentModel.findMany({
      where: { franchiseId: idNum },
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true,
        franchiseId: true,
        paymentDate: true,
        amount: true,
        paymentMode: true,
        payerName: true,
        contactNumber: true,
        utrNumber: true,
        chequeDate: true,
        chequeNumber: true,
        notes: true,
        createdAt: true,
      },
    });

    const totalReceived = payments.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const totalFeeAmount = Number(franchise.franchiseFeeAmount ?? 0);
    const balance = Math.max(0, totalFeeAmount - totalReceived);

    return Success({
      franchiseId: franchise.id,
      franchiseName: franchise.name,
      totalFeeAmount,
      totalReceived,
      balance,
      payments,
    });
  } catch (e) {
    console.error('Failed to fetch franchise fees:', e);
    return Error('Failed to fetch franchise fees');
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return BadRequest('Invalid id');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return BadRequest('Invalid JSON body');
  }

  let data: z.infer<typeof createPaymentSchema>;
  try {
    data = createPaymentSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) return BadRequest(err.errors);
    return BadRequest('Invalid body');
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const franchise = await tx.franchise.findUnique({
        where: { id: idNum },
        select: { id: true, franchiseFeeAmount: true },
      });
      if (!franchise) return { error: 'NOT_FOUND' } as const;

      const totalFeeAmount = Number(franchise.franchiseFeeAmount ?? 0);

      const agg = await (tx as any).franchiseFeePayment.aggregate({
        where: { franchiseId: idNum },
        _sum: { amount: true },
      });

      const totalReceived = Number(agg?._sum?.amount ?? 0);
      const remaining = Math.max(0, totalFeeAmount - totalReceived);

      if (remaining <= 0) return { error: 'ALREADY_PAID' } as const;
      if (Number(data.amount) > remaining) {
        return { error: 'OVERPAY', remaining } as const;
      }

      const paymentModel = (tx as any).franchiseFeePayment;
      const created = await paymentModel.create({
        data: {
          franchiseId: idNum,
          paymentDate: new Date(data.paymentDate),
          amount: data.amount,
          paymentMode: data.paymentMode,
          payerName: data.payerName?.trim() || null,
          contactNumber: data.paymentMode === 'CASH' ? (data.contactNumber?.trim() || null) : null,
          utrNumber: data.paymentMode === 'UPI' ? (data.utrNumber?.trim() || null) : null,
          chequeDate: data.paymentMode === 'CHEQUE' ? new Date(data.chequeDate || '') : null,
          chequeNumber: data.paymentMode === 'CHEQUE' ? (data.chequeNumber?.trim() || null) : null,
          notes: data.notes ?? null,
          createdByUserId: auth.user.id,
        },
        select: {
          id: true,
          franchiseId: true,
          paymentDate: true,
          amount: true,
          paymentMode: true,
          payerName: true,
          contactNumber: true,
          utrNumber: true,
          chequeDate: true,
          chequeNumber: true,
          notes: true,
          createdAt: true,
        },
      });

      return { ok: true, created } as const;
    });

    if ((result as any)?.error === 'NOT_FOUND') return NotFound('Franchise not found');
    if ((result as any)?.error === 'ALREADY_PAID') return Error('Franchise fee already fully paid', 409);
    if ((result as any)?.error === 'OVERPAY') {
      const remaining = Number((result as any).remaining ?? 0);
      return Error(`Payment exceeds remaining balance (${remaining})`, 409);
    }

    return Success((result as any).created, 201);
  } catch (e) {
    console.error('Failed to create franchise fee payment:', e);
    return Error('Failed to create payment');
  }
}
