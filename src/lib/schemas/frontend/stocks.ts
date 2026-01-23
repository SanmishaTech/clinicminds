import { z } from 'zod';

export const stockFormSchema = z.object({
  txnNo: z.string().optional(),
  txnDate: z.string().min(1, 'Date is required'),
  franchiseId: z.string()
    .refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number')
    .refine((v) => v && v.trim().length > 0, 'Franchise is required'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      medicineId: z.string()
        .refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number')
        .refine((v) => v && v.trim().length > 0, 'Medicine is required'),
      quantity: z.string()
        .refine((val) => val && val.trim().length > 0, 'Quantity is required')
        .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Quantity must be a valid positive number'),
      rate: z.string()
        .refine((val) => val && val.trim().length > 0, 'Rate is required')
        .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, 'Rate must be a valid positive number'),
      amount: z.string()
        .refine((val) => val && val.trim().length > 0, 'Amount is required')
        .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, 'Amount must be a valid positive number'),
    })
  ).min(1, 'At least one item is required'),
});

export type StockFormValues = z.infer<typeof stockFormSchema>;
