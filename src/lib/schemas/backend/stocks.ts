import z from 'zod';

export const stockLineSchema = z.object({
  medicineId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

export const createStockTransactionSchema = z.object({
  txnDate: z.string().datetime(),
  franchiseId: z.number().int().positive(),
  notes: z.string().optional().nullable(),
  items: z.array(stockLineSchema).min(1, 'At least one item is required'),
});

export type StockLineInput = z.infer<typeof stockLineSchema>;
export type CreateStockTransactionInput = z.infer<typeof createStockTransactionSchema>;
