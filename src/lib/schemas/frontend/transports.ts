import { z } from 'zod';

export const transportFormSchema = z.object({
  transporterName: z.string().optional(),
  companyName: z.string().optional(),
  transportFee: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
      'Transport fee must be a valid number'
    ),
  receiptNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type TransportFormValues = z.infer<typeof transportFormSchema>;
