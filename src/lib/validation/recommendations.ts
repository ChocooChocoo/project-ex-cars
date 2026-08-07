import { z } from "zod";

export const recommendationPreferencesSchema = z.object({
  budget: z.coerce.number().positive("Budget must be positive").min(1000, "Budget must be at least ₱1,000"),
  condition: z.enum(["any", "new", "certified", "used"]).optional().default("any"),
  fuel: z.enum(["any", "electric", "hybrid", "diesel", "petrol"]).optional().default("any"),
  bodyType: z.string().max(50).optional(),
  make: z.string().max(50).optional(),
});

export type RecommendationPreferences = z.infer<typeof recommendationPreferencesSchema>;
