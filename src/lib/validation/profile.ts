import { z } from "zod";

import { fullNameSchema, newPasswordSchema, phoneSchema } from "@/lib/validation/forms";

const PSGC_CODE = /^\d{9}$/;

// Codes and names come from the bundled PSGC lists in /psgc/. A form sends both, so a profile row never
// stores a code that the composed `address` cannot name.
function psgcCode(message: string) {
  return z.string().trim().default("").pipe(z.string().min(1, message).regex(PSGC_CODE, message));
}

function psgcName(message: string) {
  return z.string().trim().default("").pipe(z.string().min(1, message).max(60, message));
}

// T05: what a signed-in user may change about themselves. Region, city and barangay are required; the
// province is optional because NCR has no provinces.
export const ownProfileSchema = z.object({
  full_name: z.string().trim().pipe(fullNameSchema),
  phone: z.string().trim().pipe(phoneSchema).or(z.literal("")),
  address_line: z
    .string()
    .trim()
    .default("")
    .pipe(z.string().max(200, "Block and lot must be at most 200 characters.")),
  region_code: psgcCode("Choose your region."),
  region_name: psgcName("Choose your region."),
  province_code: z
    .string()
    .trim()
    .default("")
    .pipe(z.string().regex(PSGC_CODE, "Choose a province from the list.").or(z.literal(""))),
  province_name: z.string().trim().default("").pipe(z.string().max(60, "Choose a province from the list.")),
  city_code: psgcCode("Choose your city or municipality."),
  city_name: psgcName("Choose your city or municipality."),
  barangay_code: psgcCode("Choose your barangay."),
  barangay_name: psgcName("Choose your barangay."),
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
