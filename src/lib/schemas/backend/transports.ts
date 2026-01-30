import z from 'zod';

export const transportStatusSchema = z.enum(['PENDING', 'DISPATCHED', 'DELIVERED']);

const dispatchedDetailSchema = z.object({
  saleDetailId: z.number().int().positive(),
  quantity: z.number().int().min(0),
});

export const createTransportSchema = z
  .object({
    saleId: z.number().int().positive(),
    companyName: z.string().trim().min(1),
    dispatchedDetails: z.array(dispatchedDetailSchema).min(1).optional(),
    dispatchedQuantity: z.number().int().positive().optional(),
    transporterName: z.string().trim().optional(),
    transportFee: z.number().min(0),
    receiptNumber: z.string().trim().optional(),
    vehicleNumber: z.string().trim().optional(),
    trackingNumber: z.string().trim().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => (data.dispatchedDetails?.length ?? 0) > 0 || data.dispatchedQuantity !== undefined, {
    message: 'Dispatched details are required',
    path: ['dispatchedDetails'],
  });

export const updateTransportSchema = z.object({
  transporterName: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  dispatchedDetails: z.array(dispatchedDetailSchema).min(1).optional(),
  dispatchedQuantity: z.number().int().positive().optional(),
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
