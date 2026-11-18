import { z } from "zod";

import { BODY_TYPES, SEAT_OPTIONS, SEATS_BY_BODY, VEHICLE_PURPOSES } from "@/lib/vehicles/catalog";

const preferencesObject = z.object({
  budget: z.coerce.number().positive("Budget must be positive").min(1000, "Budget must be at least ₱1,000"),
  condition: z.enum(["any", "new", "certified", "used"]).optional().default("any"),
  fuel: z.enum(["any", "electric", "hybrid", "diesel", "petrol"]).optional().default("any"),
  // T06: make, body type, seats and purpose are required; everything else stays optional.
  make: z.string().trim().min(1, "Choose a make.").max(50),
  bodyType: z.enum(BODY_TYPES, { error: "Choose a body type." }),
  seats: z.enum(SEAT_OPTIONS, { error: "Choose the number of seats." }),
  purpose: z.enum(VEHICLE_PURPOSES, { error: "Choose what the car is for." }),
  transmission: z.enum(["any", "automatic", "manual"]).optional().default("any"),
  minYear: z.coerce.number().int().min(1980).max(2100).optional().or(z.literal("")),
  maxMileage: z.coerce.number().int().min(0).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional(),
});

// T12: the seat count must fit the body type.
const seatsFitBody = (data: { bodyType: (typeof BODY_TYPES)[number]; seats: (typeof SEAT_OPTIONS)[number] }) =>
  SEATS_BY_BODY[data.bodyType]?.includes(data.seats) ?? true;
const SEATS_FIT_MESSAGE = { message: "That number of seats does not fit this body type.", path: ["seats"] };

export const recommendationPreferencesSchema = preferencesObject.refine(seatsFitBody, SEATS_FIT_MESSAGE);

/** The preferences a run is saved with: everything but the budget. */
export const statedPreferencesSchema = preferencesObject.omit({ budget: true }).refine(seatsFitBody, SEATS_FIT_MESSAGE);

export type RecommendationPreferences = z.infer<typeof recommendationPreferencesSchema>;
