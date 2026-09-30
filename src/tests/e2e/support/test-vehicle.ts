import { createClient } from "@supabase/supabase-js";

// A listed car created only for an e2e run, so a spec that reserves or sells a car never touches a real
// listing. The stock code starts with E2E-T01 so these rows are easy to find and remove.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
export function canCreateTestVehicle(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function createTestVehicle(label: string, price = 500_000): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin
    .from("vehicles")
    .insert({
      stock_code: `E2E-T01-${label}-${Date.now().toString(36).toUpperCase()}`,
      make: "E2E",
      model: `Test ${label}`,
      year: 2022,
      mileage: 10_000,
      current_price: price,
      listing_state: "available",
      posted_at: new Date().toISOString(),
      description: "Created by the T01 end-to-end tests. Not a real listing.",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create the e2e test vehicle: ${error.message}`);
  return data.id as string;
}

// Takes any still-listed E2E-T01 car off the showroom after a run (a declined or aborted run leaves it
// available). Sold and reserved test cars stay as they are for inspection.
export async function archiveListedTestVehicles(): Promise<void> {
  if (!canCreateTestVehicle()) return;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );
  await admin
    .from("vehicles")
    .update({ listing_state: "archived" })
    .like("stock_code", "E2E-T01-%")
    .eq("listing_state", "available");
}
