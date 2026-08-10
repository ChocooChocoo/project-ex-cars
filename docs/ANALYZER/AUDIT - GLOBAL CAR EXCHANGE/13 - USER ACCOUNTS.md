# 13 - USER ACCOUNTS

[Back to start](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Previous: [12 - DATABASE SCHEMA](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/12%20-%20DATABASE%20SCHEMA.md) · Next: [14 - AUDIT USER ROLES](14%20-%20AUDIT%20USER%20ROLES.md)

**Last updated:** 8 August 2026 (roles, nav, and page access reconciled with the Phase 6 implementation)

All test accounts share one password. It is **not stored in this file** — it is set via the `SEED_USER_PASSWORD` environment variable in `.env.local` (git-ignored). See [Seed Script](#seed-script) below.

> **Important:** the value in `.env.local` must be quoted, for example `SEED_USER_PASSWORD="GCEtest123!@#"`. Because the value ends in `#`, leaving it unquoted makes the environment-file parser treat the `#` as a comment and silently truncate the password, which then fails login with "Invalid login credentials".

---

## Accounts

### Customer — Juan Dela Cruz

| Field | Value |
|---|---|
| Email | `customer@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `customer` |
| Landing page | `/customer/showroom` |
| Job function | Browse vehicles, inquire about listings, receive recommendations |
| Header nav | Showroom, My Inquiries, Find Your Car |
| Accessible pages | `/customer/showroom`, `/customer/showroom/[id]`, `/customer/my-inquiries`, `/customer/recommendations`, `/customer/my-transactions`, `/customer/favourites`, `/customer/sell-vehicle`, `/customer/request-a-car` |
| System purpose | Primary end user of the platform. Searches available vehicles, chats with staff about listings, and receives weighted vehicle recommendations based on budget and preferences. |

---

### Supplier — Maria Santos

| Field | Value |
|---|---|
| Email | `supplier@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `supplier` |
| Landing page | `/supplier/showroom` |
| Job function | Supply vehicles to the platform |
| Header nav | Showroom, My Inquiries, Find Your Car (same customer-facing header) |
| Accessible pages | `/supplier/showroom`, `/supplier/showroom/[id]`, `/supplier/my-inquiries`, `/supplier/recommendations`, `/supplier/my-transactions` |
| System purpose | Provides vehicles to GCE for sale. Browses the showroom to verify listings and communicates with staff through inquiries. Supplier accounts require staff creation, two primary valid IDs, and approval before sign-in. |

---

### CEO — Roberto Gonzales

| Field | Value |
|---|---|
| Email | `ceo@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `ceo` |
| Landing page | `/ceo/dashboard` |
| Job function | Oversee entire business, approve decisions, monitor performance |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Showroom, Content, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Suppliers. Staff: Staff Records, Attendance, Employee Requests, Payroll, Payslips, Field Cases, Security Duty Checks, Reports, Announcements, Supplier Messages. Pages: Roles, Users. |
| Accessible pages | `/ceo/dashboard`, `/ceo/vehicles`, `/ceo/showroom`, `/ceo/content`, `/ceo/inspections`, `/ceo/inquiries`, `/ceo/recommendations`, `/ceo/transactions`, `/ceo/roadmap`, `/ceo/roles`, `/ceo/users`, `/ceo/suppliers`, `/ceo/staff-records`, `/ceo/attendance`, `/ceo/employee-requests`, `/ceo/payroll`, `/ceo/payslips`, `/ceo/field-cases`, `/ceo/security-duty-checks`, `/ceo/reports`, `/ceo/announcements`, `/ceo/supplier-messages` |
| System purpose | Chief executive oversees all platform areas. Reviews sales, revenue, inventory, pending work, staff performance, and approvals from the source-backed dashboard; approves price proposals and reports; publishes employee announcements; manages user roles and staff records. |

---

### Account Manager — Angela Reyes

| Field | Value |
|---|---|
| Email | `account_manager@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `account_manager` |
| Landing page | `/account_manager/dashboard` |
| Job function | Manage user accounts, roles, inquiries, vehicle inventory, attendance, payroll, and staff records |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Suppliers. Staff: Staff Records, Attendance, Employee Requests, Payroll, Payslips, Field Cases, Reports, Announcements. Pages: Roles, Users. |
| Accessible pages | `/account_manager/dashboard`, `/account_manager/roles`, `/account_manager/users`, `/account_manager/vehicles`, `/account_manager/inspections`, `/account_manager/inquiries`, `/account_manager/recommendations`, `/account_manager/transactions`, `/account_manager/roadmap`, `/account_manager/suppliers`, `/account_manager/staff-records`, `/account_manager/attendance`, `/account_manager/employee-requests`, `/account_manager/payroll`, `/account_manager/payslips`, `/account_manager/field-cases`, `/account_manager/reports`, `/account_manager/announcements` |
| System purpose | Handles inquiry routing and assignment, manages viewing schedules, oversees vehicle inventory, processes attendance and employee requests, prepares payroll, records compensation, reviews vehicles, and manages user roles and account administration. Creates walk-in buyer and seller accounts. |

---

### Head Accountant — Benjamin Tan

| Field | Value |
|---|---|
| Email | `head_accountant@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `head_accountant` |
| Landing page | `/head_accountant/dashboard` |
| Job function | Financial oversight, attendance cross-check, payroll review, payslip payment responsibility |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Transactions. Staff: Attendance, Payroll, Payslips, Reports, Announcements. |
| Accessible pages | `/head_accountant/dashboard`, `/head_accountant/vehicles`, `/head_accountant/transactions`, `/head_accountant/attendance`, `/head_accountant/payroll`, `/head_accountant/payslips`, `/head_accountant/reports`, `/head_accountant/announcements` |
| System purpose | Reviews vehicle inventory and pricing, cross-checks attendance, verifies financial entries, reviews and finalizes payroll runs, marks finalized payslips as paid (salary-payment responsibility), and reviews submitted reports. |

---

### Confidential Informant — Carlos Mendoza

| Field | Value |
|---|---|
| Email | `confidential_informant@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `confidential_informant` |
| Landing page | `/confidential_informant/dashboard` |
| Job function | Source vehicles, field cases, delivery coordination |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Inspections, Transactions. Staff: Field Cases, Announcements. |
| Accessible pages | `/confidential_informant/dashboard`, `/confidential_informant/vehicles`, `/confidential_informant/inspections`, `/confidential_informant/transactions`, `/confidential_informant/field-cases`, `/confidential_informant/announcements` |
| System purpose | Sources vehicles from the market, coordinates deliveries, and handles field cases for vehicle acquisition, delivery, and recovery. Records case expenses and submits disbursement requests. Needs vehicle inventory and mechanic inspections to inform sourcing decisions. |

---

### Marketing Specialist — Diana Lim

| Field | Value |
|---|---|
| Email | `marketing_specialist@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `marketing_specialist` |
| Landing page | `/marketing_specialist/vehicles` |
| Job function | Manage vehicle listings, content, promotions, showroom media, and showroom presentation |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Showroom, Content. Staff: Announcements. |
| Accessible pages | `/marketing_specialist/dashboard`, `/marketing_specialist/vehicles`, `/marketing_specialist/showroom`, `/marketing_specialist/content`, `/marketing_specialist/announcements` |
| System purpose | Creates and manages vehicle listings, uploads vehicle photos and 360° frames, manages landing-page content, promotions, and featured vehicles. Proposes prices to the CEO for approval. Manages the public showroom presentation. |

---

### Mechanic — Eduardo Aquino

| Field | Value |
|---|---|
| Email | `mechanic@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `mechanic` |
| Landing page | `/mechanic/inspections` |
| Job function | Inspect vehicles, complete checklists, track repairs |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Inspections. Staff: Field Cases. |
| Accessible pages | `/mechanic/dashboard`, `/mechanic/vehicles`, `/mechanic/inspections`, `/mechanic/field-cases` |
| System purpose | Performs vehicle inspections using the nested checklist (system/component/part levels). Records condition scores, findings, repair status, and part replacements. Needs the vehicle inventory to know which vehicles require inspection. |

---

### Sales Manager — Fatima Castro

| Field | Value |
|---|---|
| Email | `sales_manager@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `sales_manager` |
| Landing page | `/sales_manager/vehicles` |
| Job function | Manage sales, vehicle inventory, inquiries, transactions, and customer recommendations |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Showroom, Inspections, Inquiries, Recommendations, Transactions, Roadmap. Staff: Field Cases. |
| Accessible pages | `/sales_manager/dashboard`, `/sales_manager/vehicles`, `/sales_manager/showroom`, `/sales_manager/inspections`, `/sales_manager/inquiries`, `/sales_manager/recommendations`, `/sales_manager/transactions`, `/sales_manager/roadmap`, `/sales_manager/field-cases` |
| System purpose | Manages the vehicle sales pipeline. Handles Buy Now inquiries, reviews vehicle pricing, creates walk-in accounts and transactions, monitors the showroom from the customer's perspective, oversees mechanic inspections, and reviews recommendation accuracy and customer buying patterns. |

---

### Head Security — Gregorio Villanueva

| Field | Value |
|---|---|
| Email | `head_security@gce.local` |
| Password | `[env: SEED_USER_PASSWORD]` |
| Role | `head_security` |
| Landing page | `/head_security/dashboard` |
| Job function | Security oversight, duty checks, vehicle lot awareness |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles. Staff: Security Duty Checks. |
| Accessible pages | `/head_security/dashboard`, `/head_security/vehicles`, `/head_security/security-duty-checks` |
| System purpose | Monitors vehicle inventory to know what is on the lot. Completes security duty checks with before-and-after photographic evidence uploaded to a private storage bucket. |

---

## Role-to-Page Access Matrix

| Page | CEO | Acct Mgr | Head Acct | Conf Inf | Marketing | Mechanic | Sales Mgr | Head Sec |
|---|---|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vehicles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Showroom | ✅ | — | — | — | ✅ | — | ✅ | — |
| Content | ✅ | — | — | — | ✅ | — | — | — |
| Inspections | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — |
| Inquiries | ✅ | ✅ | — | — | — | — | ✅ | — |
| Recommendations | ✅ | ✅ | — | — | — | — | ✅ | — |
| Transactions | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — |
| Roadmap | ✅ | ✅ | — | — | — | — | ✅ | — |
| Suppliers | ✅ | ✅ | — | — | — | — | — | — |
| Roles | ✅ | ✅ | — | — | — | — | — | — |
| Users | ✅ | ✅ | — | — | — | — | — | — |
| Staff Records | ✅ | ✅ | — | — | — | — | — | — |
| Attendance | ✅ | ✅ | ✅ | — | — | — | — | — |
| Employee Requests | ✅ | ✅ | — | — | — | — | — | — |
| Payroll | ✅ | ✅ | ✅ | — | — | — | — | — |
| Payslips | ✅ | ✅ | ✅ | — | — | — | — | — |
| Field Cases | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — |
| Security Duty Checks | ✅ | — | — | — | — | — | — | ✅ |
| Reports | ✅ | ✅ | ✅ | — | — | — | — | — |
| Announcements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supplier Messages | ✅ | — | — | — | — | — | — | — |

Customers and suppliers use the customer-facing header navigation (Showroom, My Inquiries, Find Your Car) and do not see the dashboard sidebar. Every staff page listed above is also protected by an action-level role check and by Supabase RLS policies; see [12 - DATABASE SCHEMA](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/12%20-%20DATABASE%20SCHEMA.md).

---

## Navigation Summary

### Staff (Dashboard Sidebar)

Every staff role sees the dashboard sidebar with role-specific items. Empty groups are hidden. The sidebar filters based on `ROLE_NAV_ACCESS` in `src/lib/auth/roles.ts`, and each role's items are listed individually above. All staff roles share the internal `(staff)` route group; the role-prefixed URL (`/ceo/...`, `/mechanic/...`, ...) is rewritten by middleware to the shared pages.

### Customer & Supplier (Header Navigation)

Customers and suppliers do not see the dashboard sidebar. A top header bar appears on the showroom, inquiries, and recommendations pages with three links: **Showroom**, **My Inquiries**, and **Find Your Car**. These users do not access any dashboard routes.

---

## Seed Script

All accounts are created by `scripts/seed-users.cjs` using the Supabase Admin API. The script:

1. Deletes any existing accounts with the seed emails
2. Creates auth users with pre-confirmed emails and the shared `SEED_USER_PASSWORD`
3. Sets user metadata (`full_name`) and updates the `profiles` table
4. Assigns roles via `assign_user_role` PostgreSQL RPC (only the CEO or Account Manager may call it)

Run the seed and role steps from the project root with the Supabase CLI linked:

```bash
node --env-file=.env.local scripts/seed-users.cjs
npx supabase db query --linked --file scripts/seed-roles.sql
```

The default password is set via the `SEED_USER_PASSWORD` environment variable. Remember to quote the value in `.env.local` (see the note at the top) so a trailing `#` is not treated as a comment.
