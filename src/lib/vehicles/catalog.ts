// Shared vehicle choices for the customer forms and the Marketing vehicle form.

export const VEHICLE_PURPOSES = [
  "Family Car",
  "For Business",
  "Personal Use",
  "Daily Commute",
  "Ride-hailing",
  "Off-road/Adventure",
] as const;

export type VehiclePurpose = (typeof VEHICLE_PURPOSES)[number];

// Common brands and models on the Philippine market. Suggestions only: the forms keep any typed value.
export const BRAND_MODELS: Record<string, readonly string[]> = {
  Toyota: ["Vios", "Wigo", "Raize", "Corolla Cross", "Innova", "Fortuner", "Hilux", "Hiace", "Rush", "Avanza", "Veloz"],
  Mitsubishi: ["Mirage", "Mirage G4", "Xpander", "Xpander Cross", "Montero Sport", "Strada", "L300"],
  Honda: ["City", "Civic", "BR-V", "HR-V", "CR-V", "Brio"],
  Nissan: ["Almera", "Navara", "Terra", "Kicks", "Urvan"],
  Ford: ["Ranger", "Everest", "Territory", "EcoSport"],
  Suzuki: ["Ertiga", "Dzire", "Celerio", "S-Presso", "Jimny", "XL7", "Swift", "Carry"],
  Hyundai: ["Accent", "Reina", "Creta", "Tucson", "Santa Fe", "Stargazer", "Staria"],
  Kia: ["Picanto", "Soluto", "Stonic", "Seltos", "Sorento", "Carnival"],
  Isuzu: ["D-Max", "mu-X", "Traviz"],
  Mazda: ["Mazda2", "Mazda3", "CX-3", "CX-5", "CX-30", "BT-50"],
  Chevrolet: ["Trailblazer", "Tracker", "Colorado"],
  Geely: ["Coolray", "Emgrand", "Okavango", "Azkarra"],
  MG: ["MG 5", "ZS", "RX5", "HS"],
  Chery: ["Tiggo 2 Pro", "Tiggo 5x", "Tiggo 7 Pro", "Tiggo 8 Pro"],
  Subaru: ["Forester", "XV", "Outback"],
};

export const BRANDS = Object.keys(BRAND_MODELS);

/** Models for a brand, matched without case so a typed "toyota" still gets Toyota's models. */
export function modelsFor(brand: string): readonly string[] {
  const key = BRANDS.find((name) => name.toLowerCase() === brand.trim().toLowerCase());
  return key ? BRAND_MODELS[key] : [];
}

export const OWNER_NUMBERS = [
  { value: "1", label: "1st owner" },
  { value: "2", label: "2nd owner" },
  { value: "3", label: "3rd owner" },
  { value: "4", label: "4th owner or more" },
] as const;

export const SELL_CONDITIONS = ["Brand New", "Second Hand"] as const;

export const OLDEST_LISTED_YEAR = 1980;

/** Years from the current year down to 1980, newest first. */
export function listedYears(now = new Date()): number[] {
  const current = now.getFullYear();
  return Array.from({ length: current - OLDEST_LISTED_YEAR + 1 }, (_, index) => current - index);
}
