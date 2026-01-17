import z from "zod";

export const medicineSchema = z.object({
    name: z.string(),
    brand: z.string(),
    rate: z.number(),
    mrp: z.number(),
});

export type Medicine = z.infer<typeof medicineSchema>;