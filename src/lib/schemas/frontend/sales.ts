import { z } from 'zod';

export const salesFormSchema = z.object({
  invoiceNo: z.string().optional(),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  franchiseId: z.string().refine(
    (v) => !v || /^\d+$/.test(v), "Must be a valid number"
  ).refine((v) => v && v.trim().length > 0, "Franchise is required"),
  totalAmount: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "Total amount is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Total must be a valid positive number"),
  saleDetails: z.array(z.object({
    medicineId: z.string().refine(
      (v) => !v || /^\d+$/.test(v), "Must be a valid number"
    ).refine((v) => v && v.trim().length > 0, "Medicine is required"),
    batchNumber: z.string().trim().min(1, 'Batch number is required'),
    expiryDate: z.string().trim().min(1, 'Expiry date is required'),
    quantity: z.string().refine((val) => val && val.trim().length > 0, "Quantity is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Quantity must be a valid positive number"),
    rate: z.string().refine((val) => val && val.trim().length > 0, "Rate is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Rate must be a valid positive number"),
    amount: z.string().refine((val) => val && val.trim().length > 0, "Amount is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Amount must be a valid positive number")
  })).min(1, "At least one sale detail is required"),
});

export type SalesFormValues = z.infer<typeof salesFormSchema>;
