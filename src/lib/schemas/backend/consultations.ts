import z from 'zod';

export const consultationDetailSchema = z.object({
  serviceId: z.number().int().positive().optional(),
  description: z.string().optional().nullable(),
  qty: z.number().int().positive(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

export const consultationMedicineSchema = z.object({
  medicineId: z.number().int().positive().optional(),
  qty: z.number().int().positive(),
  mrp: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  doses: z.string().optional().nullable(),
});

export const createConsultationSchema = z.object({
  appointmentId: z.number().int().positive(),
  complaint: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  casePaperUrl: z.string().optional().nullable(),
  nextFollowUpDate: z.string().datetime().optional().nullable(),
  totalAmount: z.number().nonnegative(),
  consultationDetails: z
    .array(consultationDetailSchema)
    .optional(),
  consultationMedicines: z
    .array(consultationMedicineSchema)
    .optional(),
  receipt: z.object({
    date: z.string().datetime().optional(),
    paymentMode: z.string().optional(),
    payerName: z.string().optional(),
    contactNumber: z.string().optional(),
    utrNumber: z.string().optional(),
    amount: z.number().nonnegative().optional(),
    chequeNumber: z.string().optional(),
    chequeDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional(),
});

export const updateConsultationSchema = createConsultationSchema.partial().extend({
  consultationDetails: z.array(consultationDetailSchema.partial()).optional(),
  consultationMedicines: z.array(consultationMedicineSchema.partial()).optional(),
});

export type ConsultationDetailInput = z.infer<typeof consultationDetailSchema>;
export type ConsultationMedicineInput = z.infer<typeof consultationMedicineSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
