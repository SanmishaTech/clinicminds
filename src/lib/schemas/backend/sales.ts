import z from 'zod';

export const saleDetailSchema = z.object({
  medicineId: z.number().int().positive(),
  batchNumber: z.string().trim().min(1),
  expiryDate: z.string().datetime(),
  quantity: z.number().int().positive(),
  rate: z.number().positive(),
  amount: z.number().positive(),
});

export const createSaleSchema = z.object({
  invoiceDate: z.string().datetime(),
  franchiseId: z.number().int().positive(),
  totalAmount: z.number().positive(),
  saleDetails: z.array(saleDetailSchema).min(1, 'At least one sale detail is required'),
});

export const updateSaleSchema = createSaleSchema.partial().extend({
  saleDetails: z.array(saleDetailSchema).optional(),
});

export type SaleDetailInput = z.infer<typeof saleDetailSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
