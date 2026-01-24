import z from 'zod';

export const saleDetailSchema = z.object({
  medicineId: z.number().int().positive(),
  batchNumber: z.string().trim().min(1),
  expiryDate: z.string().datetime(),
  quantity: z.number().int().positive(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

export const createSaleSchema = z.object({
  invoiceDate: z.string().datetime(),
  franchiseId: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).default(0),
  totalAmount: z.number().nonnegative(),
  saleDetails: z.array(saleDetailSchema).min(1, 'At least one sale detail is required'),
});

export const updateSaleSchema = createSaleSchema.partial().extend({
  saleDetails: z.array(saleDetailSchema).optional(),
});

export type SaleDetailInput = z.infer<typeof saleDetailSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
