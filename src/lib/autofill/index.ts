export interface ProfileAutoFill {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** T10: the PSGC parts, so the Buying address picker starts from the profile. */
  address_line: string | null;
  region_code: string | null;
  province_code: string | null;
  city_code: string | null;
  barangay_code: string | null;
}
