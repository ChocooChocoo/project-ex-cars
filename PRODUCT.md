# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Car buyers and sellers in the Philippines, mostly CALABARZON, using the customer portal to browse the showroom, request a car, upload IDs and pay.
- GCE staff in eight roles (CEO, Sales Manager, Head Accountant, Account Manager, Marketing Specialist, Mechanic, Confidential Informant, Head Security) running the buying, selling, payment, attendance and payroll workflows in the staff dashboard.
- Suppliers in a separate portal.

## Product Purpose

Global Car Exchange (GCE Auto Sales) sells inspected used cars and buys cars from sellers. The system takes a buyer from showroom to sale: request, document checks, approval, payment, contract, papers and handover.

## Operating Context

- Arrangements: Visit GCE (paid at the branch, no address), Meet-up in CALABARZON (CI and Mechanic team), Delivery (booked at least 7 days ahead).
- Schedules are on the hour, 9 AM to 9 PM, Monday to Saturday.
- Payment option: Full Payment (Cash, Bank Transfer, PayMongo) or Financing (+10% flat, 6, 12, 24, 36 or 60 months).
- Papers are released by the Confidential Informant before a car is marked sold.

## Capabilities and Constraints

- Next.js 16, Supabase with RLS, shadcn/ui, Tailwind v4. Signed-out visitors only see the landing page at `/` and the auth pages.
- Marketing publishes hero, promotion, featured-vehicle and announcement content (`content_items`) that the landing page shows.

## Evidence on Hand

- Real: showroom cars, prices and stock codes; Marketing's published content.
- Absent: customer testimonials, sales figures, ratings, real brand photography. Showroom media in the hosted DB is seed placeholder images. Do not fabricate any of these.

## Product Principles

- Show only true facts about GCE's process; every claim maps to a real workflow.
- Never pair one car's name with another car's photo.
- Plain, direct language for Filipino buyers; no hype.
