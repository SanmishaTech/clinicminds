import z from "zod";

export const serviceSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    rate: z.number(),
    description: z.string().optional(),
});

export type Service = z.infer<typeof serviceSchema>;