import z from 'zod';

export const packageDetailSchema = z.object({
  serviceId: z.number().int().positive(),
  description: z.string().optional().nullable(),
  qty: z.number().int().positive(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

export const packageMedicineSchema = z.object({
  medicineId: z.number().int().positive(),
  qty: z.number().int().positive(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

export const createPackageSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required').max(255, 'Package name must be less than 255 characters'),
  totalAmount: z.number().nonnegative(),
  packageDetails: z
    .array(packageDetailSchema)
    .min(1, 'At least one package detail is required'),
  packageMedicines: z
    .array(packageMedicineSchema)
    .min(1, 'At least one package medicine is required'),
});

export const updatePackageSchema = createPackageSchema.partial().extend({
  packageDetails: z.array(packageDetailSchema.partial()).optional(),
  packageMedicines: z.array(packageMedicineSchema.partial()).optional(),
});

export type PackageDetailInput = z.infer<typeof packageDetailSchema>;
export type PackageMedicineInput = z.infer<typeof packageMedicineSchema>;
export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
