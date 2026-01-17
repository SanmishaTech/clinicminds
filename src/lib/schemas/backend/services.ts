import z from "zod";

export const serviceSchema = z.object({
    name: z.string(),
    unit: z.string(),
    rate: z.number(),
    description: z.string().optional(),
});

export type Service = z.infer<typeof serviceSchema>;