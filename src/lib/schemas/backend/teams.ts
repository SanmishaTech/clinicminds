import { z } from "zod";

export const teamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(255, "Team name must be less than 255 characters"),
  email: z.string().email("Invalid email format").max(255, "Email must be less than 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(255, "Password must be less than 255 characters"),
  role: z.enum(["FRANCHISE", "DOCTOR"], {
    errorMap: (issue, ctx) => {
      if (issue.code === 'invalid_enum_value') {
        return { message: 'Role must be one of: Franchise Admin, Doctor' };
      }
      return { message: ctx.defaultError };
    }
  }),
  status: z.boolean().default(true),
  // Team-specific fields
  addressLine1: z.string().min(1, "Address Line 1 is required").max(500, "Address Line 1 must be less than 500 characters"),
  addressLine2: z.string().max(500, "Address Line 2 must be less than 500 characters").nullable().optional(),
  city: z.string().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().min(1, "State is required").max(100, "State must be less than 100 characters"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be exactly 6 digits"),
  userMobile: z.string().regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),
  joiningDate: z.string().nullable().optional(),
  leavingDate: z.string().nullable().optional(),
});

export type Team = z.infer<typeof teamSchema>;