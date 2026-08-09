const WEIGHTS = {
  budget: 0.35,
  condition: 0.25,
  fuelEfficiency: 0.15,
  demand: 0.15,
  mileage: 0.1,
} as const;

export interface VehicleInput {
  id: string;
  current_price: number | null;
  condition: string | null;
  mileage: number | null;
  fuel_type: string | null;
  make: string | null;
  model: string | null;
  body_type: string | null;
  inspection_score: number | null;
  favourite_count: number;
  inquiry_count: number;
}

export interface ScoredVehicle {
  vehicleId: string;
  budgetScore: number;
  conditionScore: number;
  fuelScore: number;
  demandScore: number;
  mileageScore: number;
  totalScore: number;
  rank: number;
}

export interface CriterionExplanation {
  label: string;
  weight: number;
  score: number;
  weightedScore: number;
  detail: string;
}

export interface ScoreExplanation {
  vehicleId: string;
  totalScore: number;
  rank: number;
  criteria: CriterionExplanation[];
}

function computeBudgetScore(price: number, budget: number): number {
  if (price <= 0) return 0;
  const deviation = Math.abs(price - budget) / budget;
  return Math.max(0, Math.round((100 - deviation * 100) * 100) / 100);
}

function computeConditionScore(condition: string | null, inspectionScore: number | null): number {
  const baseMap: Record<string, number> = { new: 100, certified: 85, used: 65 };
  const base = condition ? (baseMap[condition.toLowerCase()] ?? 50) : 50;
  if (inspectionScore !== null && inspectionScore !== undefined) {
    return Math.round((base * 0.5 + inspectionScore * 0.5) * 100) / 100;
  }
  return base;
}

function computeFuelScore(fuelType: string | null): number {
  if (!fuelType) return 40;
  const map: Record<string, number> = {
    electric: 100,
    hybrid: 85,
    diesel: 70,
    petrol: 55,
    gasoline: 55,
    lpg: 50,
  };
  return map[fuelType.toLowerCase()] ?? 40;
}

function computeDemandScore(favouriteCount: number, inquiryCount: number): number {
  const raw = favouriteCount * 10 + inquiryCount * 5;
  return Math.min(100, Math.round(raw * 100) / 100);
}

function computeMileageScore(mileage: number | null): number {
  if (mileage === null || mileage === undefined) return 50;
  return Math.max(0, Math.min(100, Math.round((100 - mileage / 2000) * 100) / 100));
}

export function rankVehicles(vehicles: VehicleInput[], budget: number): ScoredVehicle[] {
  const scored = vehicles
    .filter((v) => {
      const price = v.current_price ?? 0;
      if (price <= 0) return true;
      return price <= budget * 2;
    })
    .map((v) => {
      const price = v.current_price ?? 0;
      const budgetScore = computeBudgetScore(price, budget);
      const conditionScore = computeConditionScore(v.condition, v.inspection_score);
      const fuelScore = computeFuelScore(v.fuel_type);
      const demandScore = computeDemandScore(v.favourite_count, v.inquiry_count);
      const mileageScore = computeMileageScore(v.mileage);

      const totalScore =
        budgetScore * WEIGHTS.budget +
        conditionScore * WEIGHTS.condition +
        fuelScore * WEIGHTS.fuelEfficiency +
        demandScore * WEIGHTS.demand +
        mileageScore * WEIGHTS.mileage;

      return {
        vehicleId: v.id,
        budgetScore: Math.round(budgetScore * 100) / 100,
        conditionScore: Math.round(conditionScore * 100) / 100,
        fuelScore: Math.round(fuelScore * 100) / 100,
        demandScore: Math.round(demandScore * 100) / 100,
        mileageScore: Math.round(mileageScore * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
        rank: 0,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  let currentRank = 0;
  let prevScore = -1;
  for (const item of scored) {
    if (item.totalScore !== prevScore) {
      currentRank++;
      prevScore = item.totalScore;
    }
    item.rank = currentRank;
  }

  return scored;
}

export function explainScores(vehicle: VehicleInput, scored: ScoredVehicle): ScoreExplanation {
  const price = vehicle.current_price ?? 0;

  return {
    vehicleId: scored.vehicleId,
    totalScore: scored.totalScore,
    rank: scored.rank,
    criteria: [
      {
        label: "Budget Fit",
        weight: WEIGHTS.budget,
        score: scored.budgetScore,
        weightedScore: Math.round(scored.budgetScore * WEIGHTS.budget * 100) / 100,
        detail:
          price > 0
            ? `Price (₱${price.toLocaleString()}) compared to your budget. Score = 100 − |price − budget| / budget × 100.`
            : "No price set — budget fit could not be evaluated.",
      },
      {
        label: "Condition",
        weight: WEIGHTS.condition,
        score: scored.conditionScore,
        weightedScore: Math.round(scored.conditionScore * WEIGHTS.condition * 100) / 100,
        detail:
          vehicle.inspection_score !== null
            ? `Based on vehicle condition (${vehicle.condition ?? "unknown"}) and mechanic inspection score (${vehicle.inspection_score}/100).`
            : `Based on vehicle condition rating: ${vehicle.condition ?? "unknown"}.`,
      },
      {
        label: "Fuel Efficiency",
        weight: WEIGHTS.fuelEfficiency,
        score: scored.fuelScore,
        weightedScore: Math.round(scored.fuelScore * WEIGHTS.fuelEfficiency * 100) / 100,
        detail: vehicle.fuel_type
          ? `Based on fuel type: ${vehicle.fuel_type}. Electric > Hybrid > Diesel > Petrol.`
          : "No fuel type specified — default score applied.",
      },
      {
        label: "Demand / Resale",
        weight: WEIGHTS.demand,
        score: scored.demandScore,
        weightedScore: Math.round(scored.demandScore * WEIGHTS.demand * 100) / 100,
        detail: `Based on popularity: ${vehicle.favourite_count} favourites and ${vehicle.inquiry_count} inquiries.`,
      },
      {
        label: "Mileage",
        weight: WEIGHTS.mileage,
        score: scored.mileageScore,
        weightedScore: Math.round(scored.mileageScore * WEIGHTS.mileage * 100) / 100,
        detail:
          vehicle.mileage !== null
            ? `Mileage of ${vehicle.mileage.toLocaleString()} km. Lower mileage receives a higher score.`
            : "No mileage recorded — default score applied.",
      },
    ],
  };
}

export function getWeightLabels() {
  return [
    { key: "budget", label: "Budget Fit", weight: WEIGHTS.budget, pct: "35%" },
    { key: "condition", label: "Condition", weight: WEIGHTS.condition, pct: "25%" },
    { key: "fuelEfficiency", label: "Fuel Efficiency", weight: WEIGHTS.fuelEfficiency, pct: "15%" },
    { key: "demand", label: "Demand / Resale", weight: WEIGHTS.demand, pct: "15%" },
    { key: "mileage", label: "Mileage", weight: WEIGHTS.mileage, pct: "10%" },
  ];
}
