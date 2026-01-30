import { z } from 'zod';

const dispatchedDetailSchema = z.object({
  saleDetailId: z.coerce.number().int().positive(),
  quantity: z
    .string()
    .trim()
    .refine(
      (v) => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number.isInteger(Number(v)),
      'Dispatched quantity must be a valid whole number'
    ),
});

export const transportFormSchema = z
  .object({
    companyName: z.string().trim().min(1, 'Company name is required'),
    transporterName: z.string().trim().optional(),
    dispatchedDetails: z.array(dispatchedDetailSchema).min(1),
    transportFee: z
      .string()
      .trim()
      .refine(
        (v) => v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
        'Transport fee must be a valid number'
      ),
    receiptNumber: z.string().optional(),
    vehicleNumber: z.string().optional(),
    trackingNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const total = data.dispatchedDetails.reduce((sum, detail) => sum + (Number(detail.quantity) || 0), 0);
    if (total <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total dispatched quantity must be greater than 0',
        path: ['dispatchedDetails'],
      });
    }
  });

export type TransportFormValues = z.infer<typeof transportFormSchema>;
