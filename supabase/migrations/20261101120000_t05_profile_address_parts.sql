-- T05: the customer address is chosen from PSGC dropdowns. These columns hold the picked codes and the
-- block/lot line; `profiles.address` stays as the composed one-line string that autofill
-- (src/lib/autofill) and delivery locations already read.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS region_code TEXT,
  ADD COLUMN IF NOT EXISTS province_code TEXT,
  ADD COLUMN IF NOT EXISTS city_code TEXT,
  ADD COLUMN IF NOT EXISTS barangay_code TEXT;

-- Codes come from the bundled PSGC lists (public/psgc), so a set code is always nine digits. Rows saved
-- before T05 keep NULL codes; the app asks for the parts the next time the profile is saved.
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_psgc_codes
    CHECK (
      (region_code IS NULL OR region_code ~ '^[0-9]{9}$')
      AND (province_code IS NULL OR province_code ~ '^[0-9]{9}$')
      AND (city_code IS NULL OR city_code ~ '^[0-9]{9}$')
      AND (barangay_code IS NULL OR barangay_code ~ '^[0-9]{9}$')
    );

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_address_line_length
    CHECK (address_line IS NULL OR char_length(address_line) <= 200);
