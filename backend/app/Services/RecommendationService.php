<?php

namespace App\Services;

/**
 * PHP port of rankVehicles() in src/lib/recommendations/engine.ts. Same weights, same rounding
 * (JavaScript Math.round = floor(x + 0.5)), same dense ranking. Parity is checked against a fixture
 * produced by the TypeScript engine (tests/Fixtures/recommendation-parity.json).
 */
class RecommendationService
{
    private const WEIGHTS = ['budget' => 0.35, 'condition' => 0.25, 'fuel' => 0.15, 'demand' => 0.15, 'mileage' => 0.1];

    /**
     * @param  list<array{id: string, current_price: ?float, condition: ?string, mileage: ?int, fuel_type: ?string, inspection_score: ?float, favourite_count: int, inquiry_count: int}>  $vehicles
     * @return list<array{vehicleId: string, budgetScore: float, conditionScore: float, fuelScore: float, demandScore: float, mileageScore: float, totalScore: float, rank: int}>
     */
    public function rank(array $vehicles, float $budget): array
    {
        $scored = [];
        foreach ($vehicles as $v) {
            $price = (float) ($v['current_price'] ?? 0);
            if ($price > 0 && $price > $budget * 2) {
                continue;
            }
            $budgetScore = $this->budget($price, $budget);
            $conditionScore = $this->condition($v['condition'] ?? null, $v['inspection_score'] ?? null);
            $fuelScore = $this->fuel($v['fuel_type'] ?? null);
            $demandScore = min(100, self::round2(($v['favourite_count'] * 10) + ($v['inquiry_count'] * 5)));
            $mileageScore = $this->mileage($v['mileage'] ?? null);
            $total = $budgetScore * self::WEIGHTS['budget'] + $conditionScore * self::WEIGHTS['condition']
                + $fuelScore * self::WEIGHTS['fuel'] + $demandScore * self::WEIGHTS['demand'] + $mileageScore * self::WEIGHTS['mileage'];
            $scored[] = [
                'vehicleId' => $v['id'],
                'budgetScore' => self::round2($budgetScore),
                'conditionScore' => self::round2($conditionScore),
                'fuelScore' => self::round2($fuelScore),
                'demandScore' => self::round2($demandScore),
                'mileageScore' => self::round2($mileageScore),
                'totalScore' => self::round2($total),
                'rank' => 0,
            ];
        }
        // Array.prototype.sort is stable, so is usort since PHP 8.0.
        usort($scored, fn ($a, $b) => $b['totalScore'] <=> $a['totalScore']);
        $rank = 0;
        $prev = -1.0;
        foreach ($scored as &$item) {
            if ($item['totalScore'] !== $prev) {
                $rank++;
                $prev = $item['totalScore'];
            }
            $item['rank'] = $rank;
        }

        return $scored;
    }

    /** JavaScript Math.round(x * 100) / 100. */
    private static function round2(float $x): float
    {
        return floor($x * 100 + 0.5) / 100;
    }

    private function budget(float $price, float $budget): float
    {
        if ($price <= 0) {
            return 0;
        }
        $deviation = abs($price - $budget) / $budget;

        return max(0, floor((100 - $deviation * 100) * 100 + 0.5) / 100);
    }

    private function condition(?string $condition, ?float $inspection): float
    {
        $base = $condition !== null ? (['new' => 100, 'certified' => 85, 'used' => 65][strtolower($condition)] ?? 50) : 50;

        return $inspection !== null ? self::round2($base * 0.5 + $inspection * 0.5) : (float) $base;
    }

    private function fuel(?string $fuel): float
    {
        if (! $fuel) {
            return 40;
        }

        return (float) (['electric' => 100, 'hybrid' => 85, 'diesel' => 70, 'petrol' => 55, 'gasoline' => 55, 'lpg' => 50][strtolower($fuel)] ?? 40);
    }

    private function mileage(?int $mileage): float
    {
        return $mileage === null ? 50 : max(0, min(100, self::round2(100 - $mileage / 2000)));
    }
}
