import { describe, expect, it } from "vitest";

import { explainScores, getWeightLabels, rankVehicles, type VehicleInput } from "../engine";

function makeVehicle(overrides: Partial<VehicleInput> = {}): VehicleInput {
  return {
    id: "v1",
    current_price: 500_000,
    condition: "used",
    mileage: 50_000,
    fuel_type: "petrol",
    make: "Toyota",
    model: "Vios",
    body_type: "sedan",
    inspection_score: null,
    favourite_count: 0,
    inquiry_count: 0,
    ...overrides,
  };
}

describe("rankVehicles", () => {
  it("ranks vehicles by total score descending", () => {
    const vehicles = [
      makeVehicle({ id: "a", current_price: 400_000, condition: "new" }),
      makeVehicle({ id: "b", current_price: 600_000, condition: "used" }),
    ];
    const budget = 500_000;
    const results = rankVehicles(vehicles, budget);
    expect(results[0].vehicleId).toBe("a");
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
  });

  it("assigns same rank to tied scores", () => {
    const vehicles = [
      makeVehicle({ id: "a", current_price: 500_000, condition: "used", mileage: 50_000 }),
      makeVehicle({ id: "b", current_price: 500_000, condition: "used", mileage: 50_000 }),
    ];
    const results = rankVehicles(vehicles, 500_000);
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(1);
  });

  it("handles empty vehicle list", () => {
    const results = rankVehicles([], 500_000);
    expect(results).toHaveLength(0);
  });

  it("handles vehicle with zero price", () => {
    const v = makeVehicle({ current_price: 0 });
    const results = rankVehicles([v], 500_000);
    expect(results).toHaveLength(1);
    expect(results[0].budgetScore).toBe(0);
  });

  it("excludes vehicles priced more than 2x the budget", () => {
    const vehicles = [
      makeVehicle({ id: "within", current_price: 900_000, condition: "new" }),
      makeVehicle({ id: "over", current_price: 1_200_000, condition: "new" }),
    ];
    const results = rankVehicles(vehicles, 500_000);
    expect(results).toHaveLength(1);
    expect(results[0].vehicleId).toBe("within");
  });
});

describe("explainScores", () => {
  it("returns explanation for each criterion", () => {
    const vehicle = makeVehicle();
    const scored = {
      vehicleId: "v1",
      budgetScore: 80,
      conditionScore: 65,
      fuelScore: 55,
      demandScore: 0,
      mileageScore: 75,
      totalScore: 63.75,
      rank: 1,
    };
    const explanation = explainScores(vehicle, scored);
    expect(explanation.criteria).toHaveLength(5);
    expect(explanation.criteria[0].label).toBe("Budget Fit");
    expect(explanation.criteria[0].weight).toBe(0.35);
  });
});

describe("getWeightLabels", () => {
  it("returns five weight entries", () => {
    const labels = getWeightLabels();
    expect(labels).toHaveLength(5);
    expect(labels[0]).toEqual({
      key: "budget",
      label: "Budget Fit",
      weight: 0.35,
      pct: "35%",
    });
  });
});
