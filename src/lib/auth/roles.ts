export const GCE_ROLES = [
  "customer",
  "supplier",
  "ceo",
  "account_manager",
  "head_accountant",
  "confidential_informant",
  "marketing_specialist",
  "mechanic",
  "sales_manager",
  "head_security",
] as const;

export type GceRole = (typeof GCE_ROLES)[number];

export const ROLE_LABELS: Record<GceRole, string> = {
  customer: "Customer",
  supplier: "Supplier",
  ceo: "CEO",
  account_manager: "Account Manager",
  head_accountant: "Head Accountant",
  confidential_informant: "Confidential Informant",
  marketing_specialist: "Marketing Specialist",
  mechanic: "Mechanic",
  sales_manager: "Sales Manager",
  head_security: "Head Security",
};

export const STAFF_ROLES: GceRole[] = [
  "ceo",
  "account_manager",
  "head_accountant",
  "confidential_informant",
  "marketing_specialist",
  "mechanic",
  "sales_manager",
  "head_security",
];

export const ACCEPTED_ID_TYPES = [
  "passport",
  "drivers_license",
  "umid",
  "sss_id",
  "gsis_id",
  "philhealth_id",
  "voters_id",
  "national_id",
  "prc_id",
  "postal_id",
] as const;

export type AcceptedIdType = (typeof ACCEPTED_ID_TYPES)[number];

export const ID_LABELS: Record<AcceptedIdType, string> = {
  passport: "Passport",
  drivers_license: "Driver's License",
  umid: "UMID",
  sss_id: "SSS ID",
  gsis_id: "GSIS ID",
  philhealth_id: "PhilHealth ID",
  voters_id: "Voter's ID",
  national_id: "National ID",
  prc_id: "PRC ID",
  postal_id: "Postal ID",
};

export const ACCOUNT_STATES = ["invited", "active", "suspended", "archived"] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];

export const SUPPLIER_STATES = [
  "invited",
  "registered",
  "pending_approval",
  "approved",
  "rejected",
  "suspended",
] as const;
export type SupplierState = (typeof SUPPLIER_STATES)[number];

export const DOCUMENT_VERIFICATION_STATES = ["pending", "verified", "rejected"] as const;

/** Nav item IDs each role may see. "all" grants access to every nav item. */
export const ROLE_NAV_ACCESS: Record<GceRole, Set<string> | "all"> = {
  customer: new Set(["showroom", "inquiries"]),
  supplier: new Set(["showroom", "inquiries"]),
  ceo: new Set(["default", "vehicles", "showroom", "content", "inspections", "inquiries", "roles", "users"]),
  account_manager: new Set(["default", "roles", "users", "inspections", "inquiries"]),
  head_accountant: new Set(["default", "vehicles"]),
  marketing_specialist: new Set(["default", "vehicles", "showroom", "content"]),
  mechanic: new Set(["default", "inspections"]),
  sales_manager: new Set(["default", "vehicles", "inspections", "inquiries"]),
  confidential_informant: new Set(["default"]),
  head_security: new Set(["default"]),
};

/** Landing page path for each role after sign-in. */
export const ROLE_LANDING_PAGES: Record<GceRole, string> = {
  customer: "/showroom",
  supplier: "/showroom",
  ceo: "/dashboard/default",
  account_manager: "/dashboard/default",
  head_accountant: "/dashboard/default",
  marketing_specialist: "/dashboard/vehicles",
  mechanic: "/dashboard/inspections",
  sales_manager: "/dashboard/vehicles",
  confidential_informant: "/dashboard/default",
  head_security: "/dashboard/default",
};
