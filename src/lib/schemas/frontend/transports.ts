import { z } from 'zod';

export const transportFormSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required'),
  transporterName: z.string().trim().optional(),
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
});

export type TransportFormValues = z.infer<typeof transportFormSchema>;
