import z from "zod";

export const medicineSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    brandId: z.number(),
    rate: z.number(),
    mrp: z.number(),
});

export type Medicine = z.infer<typeof medicineSchema>;