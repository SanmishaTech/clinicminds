import z from 'zod';

export const transportStatusSchema = z.enum(['PENDING', 'DISPATCHED', 'DELIVERED']);

const dispatchedDetailSchema = z.object({
  saleDetailId: z.number().int().positive(),
  quantity: z.number().int().min(0),
});

export const createTransportSchema = z
  .object({
    saleId: z.number().int().positive(),
    transportId: z.number().int().positive().optional(),
    companyName: z.string().trim().min(1),
    dispatchedDetails: z.array(dispatchedDetailSchema).min(1).optional(),
    transporterName: z.string().trim().optional().nullable(),
    transportFee: z.number().min(0),
    receiptNumber: z.string().trim().optional().nullable(),
    vehicleNumber: z.string().trim().optional().nullable(),
    trackingNumber: z.string().trim().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((data) => (data.dispatchedDetails?.length ?? 0) > 0, {
    message: 'Dispatched details are required',
    path: ['dispatchedDetails'],
  });

export const updateTransportSchema = z.object({
  transporterName: z.string().trim().optional().nullable(),
  companyName: z.string().trim().optional().nullable(),
  dispatchedDetails: z.array(dispatchedDetailSchema).min(1).optional(),
  transportFee: z.number().min(0).optional(),
  receiptNumber: z.string().trim().optional().nullable(),
  vehicleNumber: z.string().trim().optional().nullable(),
  trackingNumber: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: transportStatusSchema.optional(),
});

export type CreateTransportInput = z.infer<typeof createTransportSchema>;
export type UpdateTransportInput = z.infer<typeof updateTransportSchema>;
export type TransportStatus = z.infer<typeof transportStatusSchema>;
