import { canUseLaravelFixtures, laravelFixture } from "./laravel-fixture";

// A listed car created only for an e2e run, so a spec that reserves or sells a car never touches a real
// listing. The stock code starts with E2E-T01 so these rows are easy to find and remove.
// Phase 5: written by the local Laravel app (`php artisan e2e:fixture`), not the Supabase service role.
export function canCreateTestVehicle(): boolean {
  return canUseLaravelFixtures();
}

export async function createTestVehicle(label: string, price = 500_000): Promise<string> {
  return laravelFixture("create-vehicle", label, price);
}

// Takes any still-listed E2E-T01 car off the showroom after a run (a declined or aborted run leaves it
// available). Sold and reserved test cars stay as they are for inspection.
export async function archiveListedTestVehicles(): Promise<void> {
  if (canCreateTestVehicle()) laravelFixture("archive-test-vehicles");
}
