import type { GceRole } from "@/lib/auth/roles";

/** Laravel `{ code, message, fieldErrors? }` error body (backend/bootstrap/app.php). */
export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/** GET /api/v1/me — twin of backend/app/Http/Resources/MeResource.php (contract-tested there). */
export interface Me {
  id: string;
  email: string;
  email_verified: boolean;
  role: GceRole | null;
  profile: {
    full_name: string | null;
    phone: string | null;
    address: string | null;
    address_line: string | null;
    region_code: string | null;
    province_code: string | null;
    city_code: string | null;
    barangay_code: string | null;
    avatar_url: string | null;
    account_state: "invited" | "active" | "suspended" | "archived" | null;
    tutorial_completed_at: string | null;
  };
}
