# 13 - USER ACCOUNTS

[Back to start](00%20-%20START%20HERE.md) · Previous: [12 - DATABASE SCHEMA](12%20-%20DATABASE%20SCHEMA.md)

**Last updated:** 8 August 2026

All test accounts share the same password: **`GCEtest123!@#`**

---

## Accounts

### Customer — Juan Dela Cruz

| Field | Value |
|---|---|
| Email | `customer@gce.local` |
| Role | `customer` |
| Landing page | `/showroom` |
| Job function | Browse vehicles, inquire about listings, receive recommendations |
| Sidebar nav | Customer header: Showroom, My Inquiries, Find Your Car |
| Accessible pages | `/showroom`, `/showroom/[id]`, `/inquiries`, `/recommendations` |
| System purpose | Primary end user of the platform. Searches available vehicles, chats with staff about listings, and receives AI-weighted vehicle recommendations based on budget and preferences. |

---

### Supplier — Maria Santos

| Field | Value |
|---|---|
| Email | `supplier@gce.local` |
| Role | `supplier` |
| Landing page | `/showroom` |
| Job function | Supply vehicles to the platform |
| Sidebar nav | Customer header: Showroom, My Inquiries, Find Your Car |
| Accessible pages | `/showroom`, `/showroom/[id]`, `/inquiries`, `/recommendations` |
| System purpose | Provides vehicles to GCE for sale. Browses the showroom to verify listings and communicates with staff through inquiries. Supplier accounts require staff creation, two primary valid IDs, and approval before sign-in. |

---

### CEO — Roberto Gonzales

| Field | Value |
|---|---|
| Email | `ceo@gce.local` |
| Role | `ceo` |
| Landing page | `/dashboard/default` |
| Job function | Oversee entire business, approve decisions, monitor performance |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Showroom, Content, Inspections, Inquiries, Recommendations. Pages: Roles, Users. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]`, `/showroom`, `/dashboard/content`, `/dashboard/inspections`, `/dashboard/inspections/[id]`, `/dashboard/inquiries`, `/dashboard/inquiries/[id]`, `/dashboard/inquiries/reports`, `/dashboard/recommendations`, `/dashboard/roles`, `/dashboard/users` |
| System purpose | Chief executive oversees all platform areas. Reviews pricing trends, stock turnover, buying patterns, market insights, and recommendation accuracy from the management dashboard. Manages user roles, approves content, and monitors staff operations. |

---

### Account Manager — Angela Reyes

| Field | Value |
|---|---|
| Email | `account_manager@gce.local` |
| Role | `account_manager` |
| Landing page | `/dashboard/default` |
| Job function | Manage user accounts, roles, inquiries, vehicle inventory |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Inspections, Inquiries, Recommendations. Pages: Roles, Users. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]`, `/dashboard/inspections`, `/dashboard/inspections/[id]`, `/dashboard/inquiries`, `/dashboard/inquiries/[id]`, `/dashboard/inquiries/reports`, `/dashboard/recommendations`, `/dashboard/roles`, `/dashboard/users` |
| System purpose | Handles inquiry routing and assignment, manages viewing schedules, oversees vehicle inventory, reviews recommended vehicles, manages user roles and account administration. Creates walk-in buyer and seller accounts. |

---

### Head Accountant — Benjamin Tan

| Field | Value |
|---|---|
| Email | `head_accountant@gce.local` |
| Role | `head_accountant` |
| Landing page | `/dashboard/default` |
| Job function | Financial oversight, vehicle pricing review |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]` |
| System purpose | Reviews vehicle inventory and pricing. Future phases will add financial reports, payroll review, and transaction oversight. Currently focused on vehicle price data accessible from the platform. |

---

### Confidential Informant — Carlos Mendoza

| Field | Value |
|---|---|
| Email | `confidential_informant@gce.local` |
| Role | `confidential_informant` |
| Landing page | `/dashboard/default` |
| Job function | Source vehicles, field cases, delivery coordination |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Inspections. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]`, `/dashboard/inspections`, `/dashboard/inspections/[id]` |
| System purpose | Sources vehicles from the market, coordinates deliveries, handles field cases for vehicle acquisition and recovery. Needs to see vehicle inventory and mechanic inspections to inform sourcing and delivery decisions. |

---

### Marketing Specialist — Diana Lim

| Field | Value |
|---|---|
| Email | `marketing_specialist@gce.local` |
| Role | `marketing_specialist` |
| Landing page | `/dashboard/vehicles` |
| Job function | Manage vehicle listings, content, promotions, and showroom presentation |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Showroom, Content. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]`, `/showroom`, `/dashboard/content` |
| System purpose | Creates and manages vehicle listings, landing page content, promotions, and featured vehicles. Proposes prices to the CEO for approval. Manages the public showroom presentation. |

---

### Mechanic — Eduardo Aquino

| Field | Value |
|---|---|
| Email | `mechanic@gce.local` |
| Role | `mechanic` |
| Landing page | `/dashboard/inspections` |
| Job function | Inspect vehicles, complete checklists, track repairs |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Inspections. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]`, `/dashboard/inspections`, `/dashboard/inspections/[id]` |
| System purpose | Performs vehicle inspections using the nested checklist (system/component/part levels). Records condition scores, findings, repair status, and part replacements. Needs to see the vehicle inventory to know which vehicles require inspection. |

---

### Sales Manager — Fatima Castro

| Field | Value |
|---|---|
| Email | `sales_manager@gce.local` |
| Role | `sales_manager` |
| Landing page | `/dashboard/vehicles` |
| Job function | Manage sales, vehicle inventory, inquiries, and customer recommendations |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles, Showroom, Inspections, Inquiries, Recommendations. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]`, `/showroom`, `/dashboard/inspections`, `/dashboard/inspections/[id]`, `/dashboard/inquiries`, `/dashboard/inquiries/[id]`, `/dashboard/inquiries/reports`, `/dashboard/recommendations` |
| System purpose | Manages the vehicle sales pipeline. Handles Buy Now inquiries, reviews vehicle pricing, monitors the showroom from the customer's perspective, oversees mechanic inspections, and reviews recommendation accuracy and customer buying patterns. |

---

### Head Security — Gregorio Villanueva

| Field | Value |
|---|---|
| Email | `head_security@gce.local` |
| Role | `head_security` |
| Landing page | `/dashboard/default` |
| Job function | Security oversight, duty checks, vehicle lot awareness |
| Dashboard sidebar | Dashboards: Default. Operations: Vehicles. |
| Accessible pages | `/dashboard/default`, `/dashboard/vehicles`, `/dashboard/vehicles/new`, `/dashboard/vehicles/[id]` |
| System purpose | Monitors vehicle inventory to know what is on the lot. Future phases will add security duty checks with before-and-after evidence, attendance records, and vehicle recovery coordination. |

---

## Role-to-Page Access Matrix

| Page | CEO | Acct Mgr | Head Acct | Conf Inf | Marketing | Mechanic | Sales Mgr | Head Sec |
|---|---|---|---|---|---|---|---|---|
| Dashboard default | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vehicles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Showroom | ✅ | — | — | — | ✅ | — | ✅ | — |
| Content | ✅ | — | — | — | ✅ | — | — | — |
| Inspections | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — |
| Inquiries | ✅ | ✅ | — | — | — | — | ✅ | — |
| Recommendations | ✅ | ✅ | — | — | — | — | ✅ | — |
| Roles | ✅ | ✅ | — | — | — | — | — | — |
| Users | ✅ | ✅ | — | — | — | — | — | — |

Customers and suppliers use the customer-facing header navigation (Showroom, My Inquiries, Find Your Car) and access `/showroom`, `/inquiries`, and `/recommendations` directly.

---

## Navigation Summary

### Staff (Dashboard Sidebar)

Every staff role sees the dashboard sidebar with role-specific items. Empty groups are hidden. The sidebar filters based on `ROLE_NAV_ACCESS` in `src/lib/auth/roles.ts`. Each role's sidebar items are listed individually in the table above.

### Customer & Supplier (Header Navigation)

Customers and suppliers do not see the dashboard sidebar. A top header bar appears on `/showroom`, `/inquiries`, and `/recommendations` with three links: **Showroom**, **My Inquiries**, and **Find Your Car**. These users do not access any `/dashboard/*` routes.

---

## Seed Script

All accounts are created by `scripts/seed-users.cjs` using the Supabase Admin API. The script:

1. Creates auth users with pre-confirmed emails
2. Sets user metadata (`full_name`)
3. Updates the `profiles` table
4. Assigns roles via `assign_user_role` PostgreSQL RPC

Default password for all: `GCEtest123!@#`
