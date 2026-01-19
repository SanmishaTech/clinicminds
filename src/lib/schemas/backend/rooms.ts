import z from "zod";

export const roomSchema = z.object({
    name: z.string().min(1, 'Room name is required').max(255, 'Room name must be less than 255 characters'),
    description: z.string().optional().nullable(),
});

export type Room = z.infer<typeof roomSchema>;
