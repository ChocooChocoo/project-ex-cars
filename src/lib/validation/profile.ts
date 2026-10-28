import { z } from "zod";

import { addressSchema, fullNameSchema, newPasswordSchema, phoneSchema } from "@/lib/validation/forms";

// T03 C15: what a signed-in user may change about themselves.
export const ownProfileSchema = z.object({
  full_name: z.string().trim().pipe(fullNameSchema),
  phone: z.string().trim().pipe(phoneSchema).or(z.literal("")),
  address: z.string().trim().pipe(addressSchema).or(z.literal("")),
});

export type OwnProfileData = z.infer<typeof ownProfileSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: newPasswordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "The new passwords do not match.",
    path: ["confirm_password"],
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: "Choose a password different from the current one.",
    path: ["new_password"],
  });
