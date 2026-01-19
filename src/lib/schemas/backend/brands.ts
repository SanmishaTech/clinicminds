import { z } from 'zod';

export const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(100, "Brand name too long"),
});

export const brandUpdateSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(100, "Brand name too long").optional(),
});
