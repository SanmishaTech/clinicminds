import z from 'zod';

export const transportStatusSchema = z.enum(['PENDING', 'DISPATCHED', 'DELIVERED']);

export const createTransportSchema = z.object({
  saleId: z.number().int().positive(),
  companyName: z.string().trim().min(1),
  transporterName: z.string().trim().optional(),
  transportFee: z.number().min(0),
  receiptNumber: z.string().trim().optional(),
  vehicleNumber: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  notes: z.string().optional(),
});

export const updateTransportSchema = z.object({
  transporterName: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  transportFee: z.number().min(0).optional(),
  receiptNumber: z.string().trim().optional(),
  vehicleNumber: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  notes: z.string().optional(),
  status: transportStatusSchema.optional(),
});

export type CreateTransportInput = z.infer<typeof createTransportSchema>;
export type UpdateTransportInput = z.infer<typeof updateTransportSchema>;
export type TransportStatus = z.infer<typeof transportStatusSchema>;
