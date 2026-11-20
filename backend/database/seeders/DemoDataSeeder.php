<?php

namespace Database\Seeders;

use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Local business records. A fixed seed keeps values reproducible apart from UUIDs and dates relative to today.
 */
class DemoDataSeeder extends Seeder
{
    /** @var array<string, string> */
    private array $u;

    private array $buyers;

    private CarbonImmutable $now;

    /** @param array<string, string> $users key => user id, from UserSeeder */
    public function run(array $users): void
    {
        $this->u = $users;
        $this->buyers = [];
        foreach (CustomerSeedData::profiles() as $key => $profile) {
            $this->buyers[$users[$key]] = $profile;
        }
        $this->now = CarbonImmutable::now('UTC');
        mt_srand(20260809);

        $vehicles = $this->seedVehicles();
        $checklist = $this->seedChecklistTemplate();
        $this->seedInspections($vehicles, $checklist);
        $this->seedInquiries($vehicles);
        $txIds = $this->seedTransactions($vehicles);
        $this->seedFavourites($vehicles);
        $this->seedContent($vehicles);
        $this->seedRecommendations($vehicles);
        $this->seedStaffRecords();
        $this->seedFinance($txIds);
        $this->seedPayroll();
        $this->seedOps();
    }

    // ---------------------------------------------------------------- helpers

    private function id(): string
    {
        return (string) Str::uuid();
    }

    private function rand(): float
    {
        return mt_rand() / (mt_getrandmax() + 1);
    }

    private function randInt(int $min, int $max): int
    {
        return mt_rand($min, $max);
    }

    /** @template T @param list<T> $items @return T */
    private function pick(array $items): mixed
    {
        return $items[mt_rand(0, count($items) - 1)];
    }

    private function preferredVehicles(array $buyer, array $vehicles): array
    {
        $score = static function (array $car) use ($buyer): int {
            $outsideBand = max(0, $buyer['budget_min'] - $car['price'], $car['price'] - $buyer['budget_max']);

            return $outsideBand * 4 + ($car['body_type'] === $buyer['body_type'] ? 0 : 130000)
                + intdiv(abs($buyer['budget_max'] - $car['price']), 8);
        };
        usort($vehicles, fn ($a, $b) => $score($a) <=> $score($b));

        return $vehicles;
    }

    private function availableVehicles(array $vehicles): array
    {
        return array_values(array_filter($vehicles, fn ($car) => $car['listing_state'] === 'available'));
    }

    private function daysAgo(int $n): CarbonImmutable
    {
        return $this->now->subDays($n);
    }

    private function ts(CarbonImmutable $d): string
    {
        return $d->utc()->format('Y-m-d H:i:s.u');
    }

    private function date(CarbonImmutable $d): string
    {
        return $d->utc()->format('Y-m-d');
    }

    /** Manila wall-clock time on the Manila calendar day of $d, stored as UTC. */
    private function pht(CarbonImmutable $d, int $hour, int $minute = 0): string
    {
        return $this->ts($d->setTimezone('Asia/Manila')->setTime($hour, $minute));
    }

    private function phtDate(CarbonImmutable $d): string
    {
        return $d->setTimezone('Asia/Manila')->format('Y-m-d');
    }

    /** @param list<array<string, mixed>> $rows */
    private function insert(string $table, array $rows): void
    {
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table($table)->insert($chunk);
        }
        $this->command?->line(sprintf('  %-34s %4d', $table, count($rows)));
    }

    /** Solid vertical-gradient PNG so seeded media renders without GD. */
    private function makePng(int $width, int $height, array $top, array $bottom): string
    {
        $raw = '';
        for ($y = 0; $y < $height; $y++) {
            $t = $y / max(1, $height - 1);
            $px = '';
            foreach ([0, 1, 2] as $c) {
                $px .= chr((int) round($top[$c] + ($bottom[$c] - $top[$c]) * $t));
            }
            $raw .= "\0".str_repeat($px, $width);
        }
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));

        return "\x89PNG\r\n\x1a\n"
            .$chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0))
            .$chunk('IDAT', gzcompress($raw))
            .$chunk('IEND', '');
    }

    /** @return array{0: int, 1: int, 2: int} */
    private function hueToRgb(int $h): array
    {
        $c = 0.6;
        $x = $c * (1 - abs(fmod($h / 60, 2) - 1));
        [$r, $g, $b] = match (true) {
            $h < 60 => [$c, $x, 0],
            $h < 120 => [$x, $c, 0],
            $h < 180 => [0, $c, $x],
            $h < 240 => [0, $x, $c],
            $h < 300 => [$x, 0, $c],
            default => [$c, 0, $x],
        };

        return [(int) round(($r + 0.05) * 255), (int) round(($g + 0.05) * 255), (int) round(($b + 0.05) * 255)];
    }

    // ---------------------------------------------------------------- 3. vehicles + media

    private const VEHICLE_SPECS = [
        ['Toyota', 'Vios', 2021, 42000, 'Good', 'Sedan', 'Gasoline', 'Automatic'],
        ['Toyota', 'Hilux', 2022, 31000, 'Excellent', 'Pickup', 'Diesel', 'Manual'],
        ['Toyota', 'Innova', 2020, 68000, 'Good', 'MPV', 'Diesel', 'Automatic'],
        ['Toyota', 'Fortuner', 2021, 52000, 'Excellent', 'SUV', 'Diesel', 'Automatic'],
        ['Toyota', 'Camry', 2019, 78000, 'Good', 'Sedan', 'Gasoline', 'Automatic'],
        ['Mitsubishi', 'Mirage G4', 2022, 18000, 'Excellent', 'Sedan', 'Gasoline', 'Manual'],
        ['Mitsubishi', 'Xpander', 2021, 44000, 'Good', 'MPV', 'Gasoline', 'Automatic'],
        ['Mitsubishi', 'Montero Sport', 2020, 72000, 'Good', 'SUV', 'Diesel', 'Automatic'],
        ['Mitsubishi', 'L300', 2018, 96000, 'Fair', 'Van', 'Diesel', 'Manual'],
        ['Honda', 'Civic', 2022, 15000, 'Excellent', 'Sedan', 'Gasoline', 'CVT'],
        ['Honda', 'HR-V', 2021, 36000, 'Excellent', 'SUV', 'Gasoline', 'CVT'],
        ['Honda', 'Brio', 2023, 8000, 'Excellent', 'Hatchback', 'Gasoline', 'Manual'],
        ['Honda', 'City', 2020, 59000, 'Good', 'Sedan', 'Gasoline', 'CVT'],
        ['Ford', 'Ranger', 2021, 48000, 'Good', 'Pickup', 'Diesel', 'Automatic'],
        ['Ford', 'Everest', 2020, 66000, 'Good', 'SUV', 'Diesel', 'Automatic'],
        ['Nissan', 'Almera', 2022, 21000, 'Excellent', 'Sedan', 'Gasoline', 'CVT'],
        ['Nissan', 'Terra', 2021, 40000, 'Good', 'SUV', 'Diesel', 'Automatic'],
        ['Suzuki', 'Ertiga', 2021, 38000, 'Good', 'MPV', 'Gasoline', 'Manual'],
        ['Suzuki', 'Swift', 2022, 25000, 'Excellent', 'Hatchback', 'Gasoline', 'CVT'],
        ['Hyundai', 'Accent', 2020, 62000, 'Good', 'Sedan', 'Diesel', 'Manual'],
        ['Kia', 'Stonic', 2022, 20000, 'Excellent', 'SUV', 'Gasoline', 'Automatic'],
        ['Isuzu', 'mu-X', 2021, 47000, 'Good', 'SUV', 'Diesel', 'Automatic'],
        ['Mazda', 'CX-5', 2021, 39000, 'Excellent', 'SUV', 'Gasoline', 'Automatic'],
        ['MG', 'ZS', 2023, 6000, 'Excellent', 'SUV', 'Gasoline', 'CVT'],
        ['Geely', 'Coolray', 2022, 17000, 'Excellent', 'SUV', 'Gasoline', 'DCT'],
        ['Nissan', 'Navara', 2019, 88000, 'Fair', 'Pickup', 'Diesel', 'Manual'],
        ['Ford', 'Fiesta', 2018, 102000, 'Fair', 'Hatchback', 'Gasoline', 'Manual'],
        ['Toyota', 'Corolla Altis', 2019, 74000, 'Good', 'Sedan', 'Gasoline', 'CVT'],
        ['Honda', 'Accord', 2018, 91000, 'Good', 'Sedan', 'Gasoline', 'Automatic'],
        ['Mitsubishi', 'Outlander', 2020, 57000, 'Good', 'SUV', 'Gasoline', 'CVT'],
        ['Toyota', 'Raize', 2023, 36000, 'Good', 'SUV', 'Gasoline', 'CVT'],
        ['Hyundai', 'Stargazer', 2023, 40000, 'Good', 'MPV', 'Gasoline', 'CVT'],
        ['Honda', 'BR-V', 2022, 52000, 'Good', 'SUV', 'Gasoline', 'CVT'],
        ['Toyota', 'Wigo', 2021, 69000, 'Good', 'Hatchback', 'Gasoline', 'Automatic'],
        ['Suzuki', 'Dzire', 2022, 55000, 'Good', 'Sedan', 'Gasoline', 'Automatic'],
        ['Toyota', 'Rush', 2021, 67000, 'Good', 'SUV', 'Gasoline', 'Automatic'],
        ['Mitsubishi', 'Strada', 2021, 70000, 'Good', 'Pickup', 'Diesel', 'Automatic'],
        ['Toyota', 'Avanza', 2022, 57000, 'Good', 'MPV', 'Gasoline', 'CVT'],
        ['Nissan', 'Almera', 2021, 67000, 'Good', 'Sedan', 'Gasoline', 'CVT'],
        ['Hyundai', 'Reina', 2022, 51000, 'Fair', 'Sedan', 'Gasoline', 'Manual'],
        ['Honda', 'Jazz', 2019, 93000, 'Fair', 'Hatchback', 'Gasoline', 'CVT'],
        ['Toyota', 'Innova', 2022, 57000, 'Good', 'MPV', 'Diesel', 'Automatic'],
        ['Ford', 'Ranger', 2023, 39000, 'Good', 'Pickup', 'Diesel', 'Automatic'],
        ['Toyota', 'Vios', 2020, 82000, 'Good', 'Sedan', 'Gasoline', 'Manual'],
        ['Mitsubishi', 'Mirage G4', 2021, 65000, 'Fair', 'Sedan', 'Gasoline', 'CVT'],
    ];

    private const LISTING_POOL = [
        'available', 'available', 'available', 'available', 'available', 'available', 'available', 'available',
        'available', 'available', 'available', 'available', 'reserved', 'reserved', 'reserved', 'reserved',
        'sold', 'sold', 'sold', 'sold', 'sold', 'sold', 'draft', 'draft', 'draft', 'draft',
        'awaiting_price_approval', 'inspecting', 'repairing', 'archived',
        'available', 'available', 'available', 'available', 'available', 'available', 'available',
        'sold', 'sold', 'sold', 'sold', 'reserved', 'reserved', 'draft', 'archived',
    ];

    private const PRICE_POOL = [
        495000, 1070000, 950000, 1430000, 930000, 429000, 758000, 1160000, 475000, 1210000, 820000, 518000, 605000,
        990000, 1180000, 590000, 1150000, 655000, 565000, 487000, 560000, 1095000, 1050000, 638000, 748000, 745000,
        350000, 615000, 650000, 780000,
        675000, 825000, 795000, 398000, 472000, 718000, 830000, 685000, 530000, 360000, 535000, 1060000, 1460000,
        395000, 348000,
    ];

    private const VARIANTS = [
        '1.3 E CVT', '2.4 G 4x2 MT', '2.8 E AT', '2.4 V 4x2 AT', '2.5 V AT', '1.2 GLX MT', '1.5 GLS AT',
        '2.4 GLS 4x2 AT', '2.2 Cab & Chassis', '1.5 V Turbo CVT', '1.8 E CVT', '1.2 S MT', '1.5 V CVT',
        '2.2 XLT 4x2 AT', '2.0 Titanium 4x2 AT', '1.0 VE Turbo CVT', '2.5 VE 4x2 AT', '1.5 GL MT', '1.2 GL CVT',
        '1.6 CRDi MT', '1.4 EX AT', '3.0 LS-A 4x2 AT', '2.0 Pro AT', '1.3 Turbo Trophy CVT', '1.5 Sport DCT',
        '2.5 EL 4x2 MT', '1.5 Trend MT', '1.6 V CVT', '2.4 S AT', '2.0 GLS CVT',
        '1.2 G CVT', '1.5 GLS IVT', '1.5 V CVT', '1.0 G AT', '1.2 GL+ AGS', '1.5 G AT', '2.4 GLS 4x2 AT',
        '1.5 G CVT', '1.0 VE Turbo CVT', '1.4 GL MT', '1.5 VX CVT', '2.8 G AT', '2.0 Wildtrak 4x2 AT',
        '1.3 J MT', '1.2 GLX CVT',
    ];

    private const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Maroon', 'Beige', 'Orange'];

    /** @return list<array{id: string, listing_state: string}> */
    private function seedVehicles(): array
    {
        $rows = [];
        foreach (self::VEHICLE_SPECS as $i => [$make, $model, $year, $mileage, $condition, $bodyType, $fuel, $transmission]) {
            $state = self::LISTING_POOL[$i];
            $rows[] = [
                'id' => $this->id(),
                'stock_code' => sprintf('GCE-%03d', $i + 1),
                'vin' => 'MHFAB3EM'.substr((string) (100000000 + $i * 7919), -9),
                'make' => $make,
                'model' => $model,
                'year' => $year,
                'condition' => $condition,
                'mileage' => $mileage,
                'fuel_type' => $fuel,
                'transmission' => $transmission,
                'exterior_color' => $this->pick(self::COLORS),
                'interior_color' => $this->pick(self::COLORS),
                'body_type' => $bodyType,
                'engine' => explode(' ', self::VARIANTS[$i], 2)[0].'L',
                'description' => "{$year} {$make} {$model} ".self::VARIANTS[$i].'. '.ucfirst(strtolower($condition)).' condition, '.number_format($mileage).' km.',
                'current_price' => in_array($state, ['awaiting_price_approval', 'draft'], true) ? null : self::PRICE_POOL[$i],
                'warranty_details' => $i % 2 === 0 ? '6-month powertrain warranty' : '1-year limited warranty',
                'offer_details' => $i % 4 === 0 ? 'Free 1-year comprehensive insurance' : null,
                'listing_state' => $state,
                'posted_at' => in_array($state, ['available', 'reserved'], true) ? $this->ts($this->daysAgo($this->randInt(2, 60))) : null,
            ];
        }
        $this->insert('vehicles', $rows);

        // Media: 3 photos per vehicle + 8 360° frames for the first 3.
        $media = [];
        $disk = Storage::disk('public');
        foreach ($rows as $i => $v) {
            $hue = ($i * 37) % 360;
            $add = function (string $kind, string $name, int $order, int $h1, int $h2) use (&$media, $disk, $v) {
                $path = "vehicles/{$v['id']}/{$name}.png";
                $media[] = [
                    'vehicle_id' => $v['id'], 'media_kind' => $kind, 'storage_path' => $path,
                    'display_order' => $order, 'public_state' => true, 'uploaded_by' => $this->u['marketing_specialist'],
                ];
                $disk->put("showroom-media/{$path}", $this->makePng(640, 480, $this->hueToRgb($h1 % 360), $this->hueToRgb($h2 % 360)));
            };
            for ($p = 0; $p < 3; $p++) {
                $add('photo', 'photo-'.($p + 1), $p, $hue + $p * 20, $hue + $p * 20 + 40);
            }
            if ($i < 3) {
                for ($f = 0; $f < 8; $f++) {
                    $add('360_view', '360-'.($f + 1), 100 + $f, $hue + $f * 14, $hue + $f * 14 + 30);
                }
            }
        }
        $this->insert('vehicle_media', $media);

        return array_map(fn ($r, $i) => [
            'id' => $r['id'], 'listing_state' => $r['listing_state'], 'price' => self::PRICE_POOL[$i],
            'body_type' => $r['body_type'], 'make' => $r['make'], 'model' => $r['model'],
        ], $rows, array_keys($rows));
    }

    // ---------------------------------------------------------------- 4. checklist template

    /** @return list<array{id: string, level: string, name: string}> */
    private function seedChecklistTemplate(): array
    {
        $systems = [
            'Engine' => ['Engine Block' => ['Cylinder Head', 'Pistons', 'Timing Belt'], 'Fuel System' => ['Fuel Pump', 'Fuel Injectors', 'Fuel Filter'], 'Cooling System' => ['Radiator', 'Water Pump', 'Thermostat']],
            'Transmission' => ['Manual Transmission' => ['Clutch Assembly', 'Gearbox', 'Clutch Cable'], 'Automatic Transmission' => ['Torque Converter', 'Valve Body', 'Transmission Fluid']],
            'Brakes' => ['Brake System' => ['Brake Pads', 'Brake Discs', 'Brake Lines'], 'Parking Brake' => ['Cable', 'Lever Assembly']],
            'Suspension' => ['Front Suspension' => ['Shock Absorbers', 'Control Arms', 'Ball Joints'], 'Rear Suspension' => ['Shock Absorbers', 'Leaf Springs', 'Bushings']],
            'Electrical' => ['Battery & Charging' => ['Battery', 'Alternator', 'Starter Motor'], 'Lighting' => ['Headlights', 'Tail Lights', 'Signal Lights']],
            'Body & Interior' => ['Exterior Body' => ['Paint Condition', 'Panels', 'Windows'], 'Interior' => ['Seats', 'Dashboard', 'Air Conditioning']],
        ];
        $rows = [];
        $order = 0;
        foreach ($systems as $sys => $components) {
            $sysId = $this->id();
            $rows[] = ['id' => $sysId, 'parent_id' => null, 'level' => 'system', 'name' => $sys, 'display_order' => $order++];
            foreach ($components as $comp => $parts) {
                $compId = $this->id();
                $rows[] = ['id' => $compId, 'parent_id' => $sysId, 'level' => 'component', 'name' => $comp, 'display_order' => $order++];
                foreach ($parts as $part) {
                    $rows[] = ['id' => $this->id(), 'parent_id' => $compId, 'level' => 'part', 'name' => $part, 'display_order' => $order++];
                }
            }
        }
        $this->insert('inspection_checklist_nodes', $rows);

        return $rows;
    }

    // ---------------------------------------------------------------- 5. inspections, repairs, documents, proposals

    private function seedInspections(array $vehicles, array $checklist): void
    {
        $parts = array_values(array_filter($checklist, fn ($n) => $n['level'] === 'part'));
        $inspectable = array_slice($vehicles, 12, 12);

        $inspections = [];
        foreach ($inspectable as $v) {
            $inspections[] = [
                'id' => $this->id(),
                'vehicle_id' => $v['id'],
                'mechanic_id' => $this->u['mechanic'],
                'condition_score' => $this->randInt(58, 96),
                'findings' => $this->pick([
                    'Engine runs smoothly; minor belt wear observed.', 'Transmission shifts cleanly; brake pads at 60%.',
                    'Suspension needs front shock replacement.', 'Minor body dents and paint scratches.',
                    'Air conditioning needs recharging; electrical system OK.', 'All systems within acceptable condition.',
                ]),
                'recommendation' => $this->pick(['Ready for listing', 'Ready after minor repairs', 'Requires suspension work', 'Recommended for resale', 'Needs detailing before listing']),
                'inspection_date' => $this->ts($this->daysAgo($this->randInt(3, 45))),
            ];
        }
        $this->insert('vehicle_inspections', $inspections);

        $results = [];
        foreach ($inspections as $inspection) {
            foreach ($parts as $part) {
                $roll = $this->rand();
                $status = $roll < 0.75 ? 'good' : ($roll < 0.9 ? 'for_repair' : 'for_replacement');
                $results[] = [
                    'id' => $this->id(),
                    'inspection_id' => $inspection['id'],
                    'checklist_entry_id' => $part['id'],
                    'status' => $status,
                    'notes' => $status === 'good' ? null : $this->pick(['Needs replacement soon', 'Light wear', 'Minor issue', 'Requires immediate attention']),
                    '_part' => $part['name'],
                ];
            }
        }
        $replacements = [];
        foreach ($results as $r) {
            if ($r['status'] !== 'good' && $this->rand() < 0.7) {
                $replacements[] = [
                    'checklist_answer_id' => $r['id'],
                    'item_name' => $r['_part'],
                    'brand' => $this->pick(['Genuine', 'Aisin', 'Denso', 'Bosch', 'NGK', 'SKF']),
                    'estimated_cost' => $this->randInt(800, 45000),
                ];
            }
        }
        $this->insert('inspection_checklist_results', array_map(fn ($r) => array_diff_key($r, ['_part' => 1]), $results));
        $this->insert('part_replacements', $replacements);

        $repairs = [];
        for ($i = 0; $i < 10; $i++) {
            $repairs[] = [
                'vehicle_id' => $this->pick($inspectable)['id'],
                'mechanic_id' => $this->u['mechanic'],
                'description' => $this->pick(['Replace front shock absorbers', 'Replace brake pads and discs', 'Engine tune-up and oil change', 'Replace clutch assembly', 'Fix radiator leak', 'Recharge air conditioning']),
                'status' => $this->pick(['pending', 'in_progress', 'completed', 'cancelled']),
                'started_at' => $this->ts($this->daysAgo($this->randInt(5, 30))),
                'completed_at' => $this->rand() < 0.5 ? $this->ts($this->daysAgo($this->randInt(1, 10))) : null,
                'notes' => 'Standard repair workflow',
            ];
        }
        $this->insert('repairs', $repairs);

        $docs = [];
        foreach ($vehicles as $v) {
            foreach (['or_cr_certificate', 'insurance', 'emission_test', 'deed_of_sale', 'inspection_report'] as $kind) {
                $roll = $this->rand();
                $verified = $roll < 0.6;
                $docs[] = [
                    'vehicle_id' => $v['id'],
                    'document_kind' => $kind,
                    'required_state' => true,
                    'submitted_state' => $verified ? 'verified' : ($roll < 0.8 ? 'submitted' : 'required'),
                    'storage_path' => $verified ? "vehicles/{$v['id']}/{$kind}.pdf" : null,
                    'checker_id' => $verified ? $this->u['sales_manager'] : null,
                    'checked_at' => $verified ? $this->ts($this->daysAgo($this->randInt(1, 40))) : null,
                ];
            }
        }
        $this->insert('vehicle_document_items', $docs);
        // Each seeded path points to a file on the private disk.
        $pdf = file_get_contents(database_path('seeders/files/sample-document.pdf'));
        foreach ($docs as $doc) {
            if ($doc['storage_path']) {
                Storage::disk('local')->put('transaction-documents/'.$doc['storage_path'], $pdf);
            }
        }

        $proposals = [];
        foreach (array_slice($vehicles, 12, 10) as $v) {
            $decision = $this->pick(['pending', 'approved', 'rejected']);
            $proposals[] = [
                'vehicle_id' => $v['id'],
                'proposed_amount' => $this->randInt(450000, 1800000),
                'proposer_id' => $this->u['marketing_specialist'],
                'decision' => $decision,
                'decider_id' => $decision === 'pending' ? null : $this->u['ceo'],
                'decision_date' => $decision === 'pending' ? null : $this->ts($this->daysAgo($this->randInt(2, 20))),
                'notes' => $this->pick(['Proposed market price', 'After inspection adjustments', 'Competitor pricing review']),
            ];
        }
        $this->insert('vehicle_price_proposals', $proposals);
    }

    // ---------------------------------------------------------------- 6. inquiries, messages, arrangements

    private function seedInquiries(array $vehicles): void
    {
        $inquiries = [];
        $vehicles = $this->availableVehicles($vehicles);
        foreach ($this->buyers as $customerId => $buyer) {
            $i = count($inquiries);
            $isBuyNow = $i % 3 === 0;
            $state = $this->pick(['open', 'assigned', 'scheduled', 'handed_off', 'closed']);
            $car = $this->preferredVehicles($buyer, $vehicles)[$i % 3];
            $inquiries[] = [
                'id' => $this->id(),
                'customer_id' => $customerId,
                'vehicle_id' => $car['id'],
                'created_at' => $this->ts($this->daysAgo($this->randInt(8, 70))),
                'intention_kind' => $isBuyNow ? 'buy_now' : 'inquiry',
                'assigned_account_manager' => ! $isBuyNow && $state !== 'open' ? $this->u['account_manager'] : null,
                'assigned_sales_manager' => $isBuyNow && $state !== 'open' ? $this->u['sales_manager'] : null,
                'handoff_state' => $state === 'handed_off' ? 'handed_off' : ($state === 'closed' ? $this->pick(['none', 'handed_off']) : 'none'),
                'state' => $state,
            ];
        }
        $this->insert('inquiries', $inquiries);

        $messages = [];
        foreach ($inquiries as $inquiry) {
            $buyer = $this->buyers[$inquiry['customer_id']];
            [$question, $answer] = match ($buyer['payment_method']) {
                'financing' => ['Can you send me the monthly amount and the downpayment?', 'I can go over the downpayment and monthly terms with you before you decide.'],
                'cash' => ['Is the listed price the total if I pay cash at the office?', 'We can confirm the cash price and go over the papers at the office.'],
                default => ['Can I inspect the car before paying by bank transfer?', 'Yes, you can inspect the car first. We will send the PayMongo checkout when you are ready.'],
            };
            $lines = [
                "Hello! I'm in {$buyer['city']}. Is this car still available?",
                'Yes, it is still available. Which day works for you to see it?',
                $question, $answer, 'Thank you. Saturday morning works for me.',
                'I will confirm the time here once I have checked the showroom schedule.',
            ];
            $opened = CarbonImmutable::parse($inquiry['created_at'], 'UTC');
            foreach ($lines as $t => $line) {
                $isCustomer = $t % 2 === 0;
                $sent = $opened->addHours($t * 3);
                $messages[] = [
                    'id' => $this->id(),
                    'inquiry_id' => $inquiry['id'],
                    'sender_id' => $isCustomer ? $inquiry['customer_id'] : ($inquiry['assigned_sales_manager'] ?? $this->u['account_manager']),
                    'message_text' => $line,
                    'sent_at' => $this->ts($sent),
                    'read_at' => $t < 5 ? $this->ts($sent->addMinutes(20)) : null,
                ];
            }
        }
        $this->insert('inquiry_messages', $messages);

        $arrangements = [];
        foreach ($inquiries as $inquiry) {
            if (count($arrangements) < 8 && in_array($inquiry['state'], ['scheduled', 'handed_off', 'closed'], true)) {
                $arrangements[] = [
                    'inquiry_id' => $inquiry['id'],
                    'vehicle_id' => $inquiry['vehicle_id'], // was set by the set_arrangement_vehicle trigger
                    'arrangement_kind' => $this->pick(['delivery', 'meetup', 'gce_visit']),
                    'schedule' => $this->ts($this->now->addDays($this->randInt(1, 10))),
                    'location' => $this->pick(['GCE Office, Dasmariñas', 'SM Mall of Asia', 'Tagaytay', 'Bacoor, Cavite']),
                    'confirmation_state' => $this->pick(['pending', 'confirmed', 'completed']),
                    'confirmed_by' => $this->rand() < 0.5 ? $this->u['account_manager'] : $this->u['sales_manager'],
                    'notes' => 'Arranged during chat',
                ];
            }
        }
        $this->insert('viewing_arrangements', $arrangements);

        $attachments = [];
        for ($i = 0; $i < 8 && isset($messages[$i * 3]); $i++) {
            $msg = $messages[$i * 3];
            $png = $this->makePng(320, 240, $this->hueToRgb(($i * 45) % 360), $this->hueToRgb(($i * 45 + 60) % 360));
            $path = "messages/{$msg['id']}/photo.png";
            Storage::disk('local')->put("message-attachments/{$path}", $png);
            $attachments[] = [
                'message_id' => $msg['id'],
                'file_kind' => 'image',
                'storage_path' => $path,
                'original_name' => $this->pick(['vehicle-photo.png', 'documents.png', 'odometer.png', 'plate.png']),
                'file_size' => strlen($png),
                'uploader_id' => $msg['sender_id'],
            ];
        }
        $this->insert('message_attachments', $attachments);

        $reports = [];
        for ($i = 0; $i < 3; $i++) {
            $msg = $messages[$i * 6 + 1];
            $reports[] = [
                'reported_message_id' => $msg['id'],
                'reported_inquiry_id' => $inquiries[$i]['id'],
                'reporter_id' => $inquiries[$i]['customer_id'],
                'reason' => ['This is the second reply I received for the same listing.', 'Please confirm this account handles the vehicle.', 'The listing price and the price I was quoted differ.'][$i],
                'state' => $this->pick(['open', 'reviewed', 'upheld', 'dismissed']),
                'reviewer_id' => $this->rand() < 0.5 ? $this->u['account_manager'] : null,
                'decision_date' => $this->rand() < 0.5 ? $this->ts($this->daysAgo($this->randInt(1, 8))) : null,
            ];
        }
        $this->insert('message_reports', $reports);
    }

    // ---------------------------------------------------------------- 7. transactions, financing, field cases

    /** @return list<string> transaction ids */
    private function seedTransactions(array $vehicles): array
    {
        $created = [];
        $buyStates = [
            'approved', 'completed', 'under_review', 'completed', 'pending', 'completed', 'approved', 'rejected',
            'completed', 'under_review', 'completed', 'cancelled', 'approved', 'completed', 'under_review',
            'completed', 'pending', 'completed', 'rejected', 'approved', 'under_review', 'completed', 'cancelled',
        ];
        $buyerIds = array_keys($this->buyers);
        $txRows = [];
        $used = [];
        foreach ($buyStates as $i => $state) {
            $id = $this->id();
            $customer = $buyerIds[$i];
            $listing = match ($state) {
                'completed' => 'sold',
                'approved' => 'reserved',
                default => 'available',
            };
            $pool = array_values(array_filter($vehicles, fn ($car) => $car['listing_state'] === $listing && ! isset($used[$car['id']])));
            $car = $this->preferredVehicles($this->buyers[$customer], $pool)[0];
            $used[$car['id']] = true;
            $age = $state === 'completed' ? $this->randInt(200, 260) : $this->randInt(6, 125);
            $txRows[] = $this->txRow($id, 'buy', $state, $car['id'], $customer, $age);
            $created[] = ['id' => $id, 'kind' => 'buy', 'state' => $state, 'customer' => $customer, 'car' => $car, 'age' => $age];
        }
        $sellVehicles = array_values(array_filter($vehicles, fn ($car) => ! isset($used[$car['id']]) && $car['listing_state'] !== 'sold'));
        usort($sellVehicles, fn ($a, $b) => ($a['listing_state'] === 'available') <=> ($b['listing_state'] === 'available'));
        foreach (['pending', 'under_review', 'pending', 'rejected', 'approved', 'under_review', 'approved', 'cancelled', 'completed', 'completed'] as $i => $state) {
            $id = $this->id();
            $customer = $buyerIds[1 + $i * 3];
            $car = $sellVehicles[$i];
            $age = $this->randInt(7, 260);
            $txRows[] = $this->txRow($id, 'sell', $state, $car['id'], $customer, $age);
            $created[] = ['id' => $id, 'kind' => 'sell', 'state' => $state, 'customer' => $customer, 'car' => $car, 'age' => $age];
        }
        $this->insert('transactions', $txRows);

        $history = [];
        $flows = [
            'pending' => ['pending'], 'under_review' => ['pending', 'under_review'], 'approved' => ['pending', 'under_review', 'approved'],
            'rejected' => ['pending', 'under_review', 'rejected'], 'completed' => ['pending', 'under_review', 'approved', 'completed'],
            'cancelled' => ['pending', 'cancelled'],
        ];
        $reviews = [];
        foreach ($created as $t) {
            $prev = 'pending';
            foreach ($flows[$t['state']] as $step => $s) {
                $reason = match ($s) {
                    'pending' => 'Request opened by customer.',
                    'under_review' => 'GCE received the request and began checking the submitted documents.',
                    'approved' => 'Documents and transaction details verified.',
                    'completed' => $t['kind'] === 'buy' ? 'Payment settled and vehicle handed over.' : 'Seller paid and original papers received.',
                    'rejected' => $t['kind'] === 'buy' ? 'The proof of billing could not be matched to the address on the request.' : 'The seller could not supply the original certificate of registration.',
                    'cancelled' => $t['kind'] === 'buy' ? 'The buyer chose a different vehicle before the appointment.' : 'The owner decided to keep the vehicle.',
                };
                $history[] = [
                    'transaction_id' => $t['id'],
                    'from_state' => $prev,
                    'to_state' => $s,
                    'actor_id' => in_array($s, ['pending', 'cancelled'], true) ? $t['customer'] : $this->u[$t['kind'] === 'buy' ? 'sales_manager' : 'marketing_specialist'],
                    'reason' => $reason,
                    'changed_at' => $this->ts($s === 'completed'
                        ? $this->completedAt($t['kind'], $t['customer'], $t['age'])
                        : $this->daysAgo($t['age'] - $step)),
                ];
                $prev = $s;
            }
            if ($t['state'] === 'completed' && $t['kind'] === 'buy') {
                $reviews[] = [
                    'transaction_id' => $t['id'], 'customer_id' => $t['customer'], 'vehicle_id' => $t['car']['id'],
                    'rating' => count($reviews) % 3 === 0 ? 4 : 5,
                    'body' => $this->pick(['The staff explained the papers before we paid.', 'We had time to inspect the car and check the service history.', 'Pick-up took a little longer than planned, but the price matched the agreement.']),
                    'created_at' => $this->ts($this->completedAt('buy', $t['customer'], $t['age'])->addDays(2)->min($this->now)),
                ];
            }
        }
        $this->insert('transaction_status_history', $history);
        $this->insert('customer_reviews', $reviews);

        $buyTxs = array_values(array_filter($created, fn ($t) => $t['kind'] === 'buy'));
        $purchases = [];
        $documents = [];
        $pdf = file_get_contents(database_path('seeders/files/sample-document.pdf'));
        foreach ($buyTxs as $i => $t) {
            $buyer = $this->buyers[$t['customer']];
            $method = $buyer['payment_method'];
            $arrangement = ['gce_visit', 'meetup', 'delivery'][$i % 3];
            $verified = in_array($t['state'], ['approved', 'completed'], true);
            $documentState = $verified ? 'verified' : ($t['state'] === 'rejected' ? 'rejected' : 'pending');
            $purchases[] = [
                'transaction_id' => $t['id'],
                'payment_method' => $method,
                'final_price' => $t['car']['price'],
                'arrangement_kind' => $arrangement,
                'location' => match ($arrangement) {
                    'gce_visit' => 'GCE Office, Dasmariñas',
                    'delivery' => $buyer['address'],
                    default => 'City Hall parking area, '.$buyer['city'],
                },
                'document_check_state' => $documentState,
                'checked_by' => $documentState !== 'pending' ? $this->u['sales_manager'] : null,
                'checked_at' => $documentState !== 'pending' ? $this->ts($this->daysAgo($t['age'] - 1)) : null,
                'payment_option' => $method === 'financing' ? 'financing' : 'full',
                'requested_term_months' => $method === 'financing' ? 6 : null,
            ];
            foreach ([
                ['valid_id', 'drivers_license', 'front'], ['valid_id', 'drivers_license', 'back'],
                ['valid_id', 'national_id', 'front'], ['valid_id', 'national_id', 'back'],
                ['proof_of_billing', null, null], ['payslip', null, null],
            ] as $j => [$kind, $type, $side]) {
                $path = "{$t['id']}/{$kind}-".($j + 1).'.pdf';
                $rejected = $documentState === 'rejected' && $kind === 'proof_of_billing';
                Storage::disk('local')->put('transaction-documents/'.$path, $pdf);
                $documents[] = [
                    'transaction_id' => $t['id'], 'document_kind' => $kind, 'storage_path' => $path,
                    'id_type' => $type, 'id_side' => $side, 'uploader_id' => $t['customer'],
                    'verification_state' => $rejected ? 'rejected' : ($verified ? 'verified' : 'pending'),
                    'verifier_id' => $verified || $rejected ? $this->u['sales_manager'] : null,
                    'rejection_reason' => $rejected ? 'The utility account address does not match this request.' : null,
                    'upload_date' => $this->ts($this->daysAgo($t['age'])),
                ];
            }
        }
        $this->insert('purchase_details', $purchases);
        $this->insert('transaction_documents', $documents);

        $sells = [];
        $ceilings = [];
        foreach (array_values(array_filter($created, fn ($t) => $t['kind'] === 'sell')) as $i => $t) {
            $decided = in_array($t['state'], ['approved', 'completed', 'rejected'], true);
            $accepted = in_array($t['state'], ['approved', 'completed'], true);
            $ceiling = (int) (round($t['car']['price'] * 0.79 / 1000) * 1000);
            $issue = [null, 'Aircon is not cold at idle.', 'Small dent on the rear bumper.', 'The right rear window is slow.', null][$i % 5];
            $sells[] = [
                'transaction_id' => $t['id'],
                'offered_amount' => (int) (round($ceiling * (1.06 + $i * 0.009) / 1000) * 1000),
                'valuation_amount' => $ceiling,
                'agreed_price' => $accepted ? $ceiling - 5000 : null,
                'has_known_issues' => $issue !== null,
                'declared_issues' => $issue,
                'meetup_method' => $i % 2 === 0 ? 'gce_visit' : 'meet_halfway',
                'meetup_address' => $i % 2 === 0 ? null : $this->buyers[$t['customer']]['address'],
                'owner_number' => 1 + $i % 3,
                'review_notes' => $t['state'] === 'rejected' ? 'Original certificate of registration was not supplied.' : ($decided ? 'Valuation confirmed against recent sales.' : null),
                'decision' => $accepted ? 'accepted' : ($t['state'] === 'rejected' ? 'rejected' : null),
                'decision_maker_id' => $decided ? $this->u['ceo'] : null,
                'decision_date' => $decided ? $this->ts($this->daysAgo($t['age'] - 2)) : null,
            ];
            $ceilings[] = [
                'vehicle_id' => $t['car']['id'], 'transaction_id' => $t['id'], 'proposal_kind' => 'purchase_ceiling',
                'proposed_amount' => $ceiling, 'proposer_id' => $this->u['marketing_specialist'],
                'decision' => $accepted ? 'approved' : ($t['state'] === 'rejected' ? 'rejected' : 'pending'),
                'decider_id' => $decided ? $this->u['ceo'] : null,
                'decision_date' => $decided ? $this->ts($this->daysAgo($t['age'] - 2)) : null,
            ];
        }
        $this->insert('sell_details', $sells);
        $this->insert('vehicle_price_proposals', $ceilings);

        $accounts = [];
        $terms = [];
        $installments = [];
        $payments = [];
        foreach ($buyTxs as $i => $t) {
            $method = $purchases[$i]['payment_method'];
            $price = $purchases[$i]['final_price'];
            $done = $t['state'] === 'completed';
            $agreement = $this->daysAgo($t['age'] - 3);
            if ($method !== 'financing') {
                if ($done) {
                    $payments[] = $this->paymentRow($t['id'], null, $price, $method, 'full', $agreement);
                }

                continue;
            }
            if (! in_array($t['state'], ['approved', 'completed'], true)) {
                continue;
            }
            $down = (int) round($price * 0.2);
            $total = (int) round($price * 1.1);
            $balance = $total - $down;
            $count = 6;
            $per = intdiv($balance, $count);
            $accountId = $this->id();
            $accounts[] = [
                'id' => $accountId, 'purchase_transaction_id' => $t['id'], 'financed_total' => $total,
                'down_payment' => $down, 'opening_balance' => $balance, 'start_date' => $this->date($agreement),
                'state' => $done ? 'closed' : 'active',
                'closed_date' => $done ? $this->date($agreement->addMonthsNoOverflow($count)) : null,
            ];
            $terms[] = [
                'purchase_transaction_id' => $t['id'], 'arrangement_description' => 'Monthly installments with 20% downpayment.',
                'total_amount' => $total, 'down_payment' => $down, 'number_of_payments' => $count,
                'payment_frequency' => 'monthly', 'duration_months' => $count, 'monthly_payment' => $per,
                'first_due_date' => $this->date($agreement->addMonthNoOverflow()), 'agreed_by' => $this->u['sales_manager'],
                'approver_id' => $this->u['ceo'], 'approval_date' => $this->ts($agreement),
                'state' => $done ? 'completed' : 'active',
            ];
            $payments[] = $this->paymentRow($t['id'], null, $down, 'paymongo', 'downpayment', $agreement);
            for ($s = 1; $s <= $count; $s++) {
                $due = $agreement->addMonthsNoOverflow($s);
                $isPaid = $done || $due->lt($this->now->subDays(30));
                $amount = $s === $count ? $balance - $per * ($count - 1) : $per;
                $installmentId = $this->id();
                $installments[] = [
                    'id' => $installmentId,
                    'account_id' => $accountId,
                    'sequence_no' => $s,
                    'due_date' => $this->date($due),
                    'amount_due' => $amount,
                    'state' => $isPaid ? 'paid' : ($due->lt($this->now) ? 'overdue' : 'upcoming'),
                    'payment_date' => $isPaid ? $this->date($due) : null,
                ];
                if ($isPaid) {
                    $payments[] = $this->paymentRow($t['id'], $installmentId, $amount, 'paymongo', 'installment', $due);
                }
            }
        }
        $this->insert('installment_accounts', $accounts);
        $this->insert('payment_terms', $terms);
        $this->insert('installments', $installments);
        $this->insert('payment_records', $payments);

        $collections = [];
        foreach ($installments as $inst) {
            if ($inst['state'] === 'overdue') {
                $collections[] = [
                    'installment_id' => $inst['id'],
                    'action_kind' => $this->pick(['notice', 'ultimatum']),
                    'actor_id' => $this->u['head_accountant'],
                    'deadline' => $this->date($this->now->addDays($this->randInt(3, 14))),
                    'notes' => 'First collection notice sent to buyer.',
                ];
            }
        }
        $this->insert('collection_actions', $collections);

        $cases = [];
        $cis = [$this->u['confidential_informant'], $this->u['confidential_informant2'], $this->u['confidential_informant3'], $this->u['confidential_informant4']];
        $mechanics = [$this->u['mechanic'], $this->u['mechanic2'], $this->u['mechanic3'], $this->u['mechanic4']];
        $purchaseById = array_column($purchases, null, 'transaction_id');
        foreach ($created as $t) {
            if (! in_array($t['state'], ['approved', 'completed', 'under_review'], true)) {
                continue;
            }
            $arrangement = $purchaseById[$t['id']]['arrangement_kind'] ?? null;
            if ($arrangement === 'gce_visit' || ($t['kind'] === 'buy' && $t['state'] === 'under_review')) {
                continue;
            }
            $kind = $t['kind'] === 'sell' ? 'acquisition' : ($arrangement === 'delivery' ? 'delivery' : 'buyer_meetup');
            $done = $t['state'] === 'completed';
            $cases[] = [
                'vehicle_id' => $t['car']['id'],
                'transaction_id' => $t['id'],
                'case_kind' => $kind,
                'assigned_confidential_informant' => $this->pick($cis),
                'mechanic_id' => $this->rand() < 0.4 ? $this->pick($mechanics) : null,
                'schedule' => $this->ts($done ? $this->daysAgo($t['age'] - 4) : $this->now->addDays($this->randInt(1, 10))),
                'location' => $purchaseById[$t['id']]['location'] ?? $this->buyers[$t['customer']]['address'],
                'state' => $done ? 'completed' : $this->pick(['assigned', 'accepted', 'in_progress']),
                'completion_date' => $done ? $this->ts($this->daysAgo($t['age'] - 4)) : null,
                'expenses_cents' => $done ? $this->randInt(500, 2500) * 100 : 0,
                'notes' => $t['kind'] === 'sell' ? 'Bring the inspection checklist and confirm the original papers.' : 'Call the buyer before departure and bring the vehicle papers.',
            ];
        }
        $this->insert('field_cases', $cases);

        return array_column($created, 'id');
    }

    private function completedAt(string $kind, string $customer, int $age): CarbonImmutable
    {
        $agreement = $this->daysAgo($age - 3);

        return $kind === 'buy' && $this->buyers[$customer]['payment_method'] === 'financing'
            ? $agreement->addMonthsNoOverflow(6)
            : $agreement;
    }

    private function txRow(string $id, string $kind, string $state, string $vehicleId, string $customer, int $age): array
    {
        return [
            'id' => $id,
            'customer_id' => $customer,
            'transaction_kind' => $kind,
            'vehicle_id' => $vehicleId,
            'current_state' => $state,
            'created_by' => $customer,
            'opened_at' => $this->ts($this->daysAgo($age)),
            'completed_at' => $state === 'completed' ? $this->ts($this->completedAt($kind, $customer, $age))
                : (in_array($state, ['cancelled', 'rejected'], true) ? $this->ts($this->daysAgo($age - ($state === 'rejected' ? 2 : 1))) : null),
        ];
    }

    private function paymentRow(string $txId, ?string $installmentId, int $amount, string $method, string $kind, CarbonImmutable $settled): array
    {
        return [
            'transaction_id' => $txId,
            'installment_id' => $installmentId,
            'amount' => $amount,
            'method' => $method,
            'payment_kind' => $kind,
            'external_reference' => sprintf('REF-%05d', (int) floor($this->rand() * 100000)),
            'recorded_by' => $this->u['head_accountant'],
            'verified_by' => $this->u['head_accountant'],
            'approved_by' => $kind === 'installment' ? $this->u['sales_manager'] : null,
            'approved_at' => $kind === 'installment' ? $this->ts($settled) : null,
            'settlement_date' => $this->date($settled),
            'paid_at' => $this->ts($settled),
        ];
    }

    // ---------------------------------------------------------------- 8. favourites, content, recommendations

    private function seedFavourites(array $vehicles): void
    {
        $rows = [];
        $available = $this->availableVehicles($vehicles);
        foreach ($this->buyers as $customerId => $buyer) {
            foreach (array_slice($this->preferredVehicles($buyer, $available), 0, $this->randInt(1, 4)) as $car) {
                $rows[] = ['customer_id' => $customerId, 'vehicle_id' => $car['id']];
            }
        }
        $this->insert('favourites', $rows);
    }

    private function seedContent(array $vehicles): void
    {
        $items = [
            ['hero', 'Drive Home Your Dream Car', 'Discover quality pre-owned vehicles at Global Car Exchange.', 'published'],
            ['hero', 'Trusted Dealership. Verified Units.', 'Every vehicle inspected by certified mechanics.', 'published'],
            ['hero', 'Flexible Payment Terms', 'Weekly and monthly plans available on select units.', 'draft'],
            ['promotion', 'Free Insurance Promo', 'Get 1-year comprehensive insurance on featured units.', 'published'],
            ['promotion', 'Year-End Clearance Sale', 'Up to 10% off on 2020 models while stocks last.', 'published'],
            ['promotion', 'Trade-In Bonus', 'Extra ₱20,000 trade-in value this month.', 'draft'],
            ['featured_vehicle', '2022 Toyota Hilux — Featured', 'Excellent condition, diesel, low mileage.', 'published'],
            ['featured_vehicle', '2022 Honda Civic — Featured', 'Top-rated fuel efficiency and performance.', 'published'],
            ['featured_vehicle', '2021 Mitsubishi Montero — Featured', 'Family-ready SUV with flexible financing.', 'draft'],
        ];
        $rows = [];
        foreach ($items as $i => [$kind, $title, $body, $state]) {
            $rows[] = [
                'content_kind' => $kind,
                'title' => $title,
                'body' => $body,
                'publication_state' => $state,
                'vehicle_id' => $i < 6 ? null : $vehicles[$i % count($vehicles)]['id'],
                'author_id' => $this->u['marketing_specialist'],
                'published_at' => $state === 'published' ? $this->ts($this->daysAgo($this->randInt(3, 30))) : null,
            ];
        }
        $this->insert('content_items', $rows);
    }

    private function seedRecommendations(array $vehicles): void
    {
        $runs = [];
        foreach ($this->buyers as $customerId => $buyer) {
            $runs[] = [
                'id' => $this->id(),
                'customer_id' => $customerId,
                'budget' => $buyer['budget_max'],
                'stated_preferences' => json_encode(array_intersect_key($buyer, array_flip([
                    'budget_min', 'budget_max', 'body_type', 'intended_use', 'payment_method', 'income_band', 'occupation',
                ])), JSON_UNESCAPED_UNICODE),
                'criteria_version' => '1.0',
                'run_date' => $this->ts($this->daysAgo($this->randInt(2, 40))),
            ];
        }
        $this->insert('recommendation_runs', $runs);

        $eligible = $this->availableVehicles($vehicles);
        $results = [];
        $feedback = [];
        foreach ($runs as $run) {
            $buyer = $this->buyers[$run['customer_id']];
            $ranked = array_slice($this->preferredVehicles($buyer, $eligible), 0, 8);
            foreach ($ranked as $rank => $v) {
                $base = 100 - $rank * 6 - $this->randInt(0, 4);
                $results[] = [
                    'run_id' => $run['id'],
                    'vehicle_id' => $v['id'],
                    'budget_score' => max(0, 100 - (int) round(max(0, $v['price'] - $buyer['budget_max']) / 10000)),
                    'condition_score' => max(55, $base - $this->randInt(0, 6)),
                    'fuel_score' => max(55, $base - $this->randInt(0, 10)),
                    'demand_score' => max(55, $base - $this->randInt(0, 8)),
                    'mileage_score' => max(55, $base - $this->randInt(0, 12)),
                    'total_score' => $base,
                    'rank' => $rank + 1,
                ];
            }
            $feedback[] = [
                'run_id' => $run['id'],
                'selected_vehicle_id' => $ranked[$this->randInt(0, 2)]['id'],
                'helpful_state' => $this->pick(['helpful', 'helpful', 'not_helpful', 'unknown']),
                'outcome' => $this->pick(['Asked about a viewing', 'Saved the vehicle to compare', 'Still comparing prices', null]),
                'feedback_date' => $this->ts(CarbonImmutable::parse($run['run_date'], 'UTC')->addDay()),
            ];
        }
        $this->insert('recommendation_results', $results);
        $this->insert('recommendation_feedback', $feedback);
    }

    // ---------------------------------------------------------------- 9. staff records

    /** @return list<array{role: string, id: string}> */
    private function staff(): array
    {
        $keys = ['ceo' => 'ceo', 'mechanic' => 'mechanic', 'mechanic2' => 'mechanic', 'mechanic3' => 'mechanic', 'mechanic4' => 'mechanic',
            'sales_manager' => 'sales_manager', 'marketing_specialist' => 'marketing_specialist', 'account_manager' => 'account_manager',
            'head_accountant' => 'head_accountant', 'confidential_informant' => 'confidential_informant', 'confidential_informant2' => 'confidential_informant',
            'confidential_informant3' => 'confidential_informant', 'confidential_informant4' => 'confidential_informant', 'head_security' => 'head_security'];

        return array_map(fn ($key, $role) => ['role' => $role, 'id' => $this->u[$key]], array_keys($keys), $keys);
    }

    private function seedStaffRecords(): void
    {
        $staff = $this->staff();
        // Single source shared with the Next.js app.
        $roleSchedules = json_decode(file_get_contents(base_path('../src/lib/attendance/role-schedules.json')), true, flags: JSON_THROW_ON_ERROR);
        $default = ['workdays' => [1, 2, 3, 4, 5, 6, 7], 'start_time' => '08:00:00', 'end_time' => '17:00:00', 'grace_minutes' => 10, 'timezone' => 'Asia/Manila'];
        $schedules = [];
        foreach ($staff as $person) {
            $s = $roleSchedules[$person['role']] ?? $default;
            $schedules[] = [
                'employee_id' => $person['id'],
                'workdays' => json_encode($s['workdays']),
                'start_time' => $s['start_time'],
                'end_time' => $s['end_time'],
                'grace_minutes' => $s['grace_minutes'],
                'timezone' => $s['timezone'],
                'created_by' => $this->u['account_manager'],
                'updated_by' => $this->u['account_manager'],
            ];
        }
        $this->insert('employee_work_schedules', $schedules);

        $attendance = [];
        foreach ($staff as $person) {
            for ($d = 24; $d >= 1; $d--) {
                $day = $this->now->subDays($d)->setTimezone('Asia/Manila');
                if ($day->isWeekend()) {
                    continue;
                }
                $roll = $this->rand();
                $status = $roll < 0.8 ? 'present' : ($roll < 0.88 ? 'late' : ($roll < 0.95 ? 'on_leave' : 'absent'));
                $hasTimes = in_array($status, ['present', 'late'], true);
                $attendance[] = [
                    'employee_id' => $person['id'],
                    'attendance_date' => $day->format('Y-m-d'),
                    'time_in' => $hasTimes ? $this->pht($day, 8, $this->randInt(0, 30)) : null,
                    'time_out' => $hasTimes ? $this->pht($day, 17, $this->randInt(0, 45)) : null,
                    'status' => $status,
                    'notes' => $status === 'on_leave' ? 'Approved leave' : ($status === 'absent' ? 'Unreported absence' : null),
                    'checked_by' => $this->rand() < 0.6 ? $this->u['account_manager'] : null,
                    'checked_at' => $this->rand() < 0.6 ? $this->ts($day) : null,
                ];
            }
        }
        $today = $this->phtDate($this->now);
        $nowTs = $this->ts($this->now);
        foreach ([
            ['ceo', 8, 0, 17, 'present', 'Arrived on time', null],
            ['account_manager', 8, 20, 17, 'late', 'Arrived 25 minutes late, heavy traffic on SLEX', 'ceo'],
            ['head_accountant', null, 0, null, 'absent', 'Did not report for work, no notice given', 'ceo'],
            ['marketing_specialist', 8, 0, 12, 'half_day', 'Half day, left after lunch for a clinic appointment', 'account_manager'],
            ['sales_manager', null, 0, null, 'on_leave', 'On approved vacation leave', 'account_manager'],
        ] as [$who, $inH, $inM, $outH, $status, $note, $checker]) {
            $attendance[] = [
                'employee_id' => $this->u[$who],
                'attendance_date' => $today,
                'time_in' => $inH === null ? null : $this->pht($this->now, $inH, $inM),
                'time_out' => $outH === null ? null : $this->pht($this->now, $outH),
                'status' => $status,
                'notes' => $note,
                'checked_by' => $checker ? $this->u[$checker] : null,
                'checked_at' => $checker ? $nowTs : null,
            ];
        }
        $this->insert('attendance_entries', $attendance);

        $requests = [];
        for ($i = 0; $i < 15; $i++) {
            $person = $this->pick($staff);
            $kind = $this->pick(['leave', 'overtime', 'schedule_change', 'other']);
            $start = $this->now->addDays($this->randInt(2, 30));
            $leaveDays = $kind === 'leave' ? $this->randInt(0, 5) : 0;
            $requests[] = [
                'employee_id' => $person['id'],
                'request_kind' => $kind,
                'leave_reason' => $kind === 'leave' ? 'others' : null,
                'overtime_hours' => $kind === 'overtime' ? 2 : null,
                'status' => $this->pick(['pending', 'approved', 'rejected']),
                'start_date' => $this->date($start),
                'end_date' => $kind === 'leave' ? $this->date($start->addDays($leaveDays)) : null,
                'reason' => $this->pick(['Family event', 'Medical appointment', 'Overtime for inventory week', 'Schedule adjustment request', 'Personal errand']),
                'reviewed_by' => $this->rand() < 0.6 ? $this->u['account_manager'] : null,
                'review_notes' => $this->rand() < 0.4 ? 'Approved by Account Manager' : null,
                'reviewed_at' => $this->rand() < 0.6 ? $this->ts($this->daysAgo($this->randInt(1, 10))) : null,
            ];
        }
        $requests[] = [
            'employee_id' => $this->u['mechanic'], 'request_kind' => 'leave', 'leave_reason' => 'others', 'overtime_hours' => null,
            'status' => 'approved', 'start_date' => $today, 'end_date' => $today, 'reason' => 'Family event in the province',
            'reviewed_by' => $this->u['account_manager'], 'review_notes' => 'Approved by Account Manager', 'reviewed_at' => $nowTs,
        ];
        $this->insert('employee_requests', $requests);

        $reviews = [];
        for ($i = 0; $i < 10; $i++) {
            $reviews[] = [
                'employee_id' => $this->pick($staff)['id'],
                'reviewer_id' => $this->u['account_manager'],
                'review_period_start' => $this->date($this->now->subDays(90)),
                'review_period_end' => $this->date($this->now->subDays(30)),
                'rating' => $this->randInt(3, 5),
                'strengths' => $this->pick(['Reliable and consistent', 'Excellent customer handling', 'Strong technical skills', 'Great team player']),
                'areas_for_improvement' => $this->pick(['Needs faster turnaround', 'Documentation could improve', 'Time management', 'None at this time']),
                'goals' => $this->pick(['Complete certification this quarter', 'Improve response times', 'Mentor new staff', 'Maintain quality rating']),
                'status' => $this->pick(['draft', 'submitted', 'acknowledged']),
                'acknowledged_at' => $this->rand() < 0.3 ? $this->ts($this->daysAgo($this->randInt(2, 15))) : null,
            ];
        }
        $this->insert('performance_reviews', $reviews);
    }

    // ---------------------------------------------------------------- 10. finance, disbursements, reports, announcements

    private function seedFinance(array $txIds): void
    {
        $entries = [];
        $entry = fn (string $kind, int $cents, ?string $tx, array $descs, float $verifyOdds, int $maxAgo, int $maxVerifyAgo) => [
            'entry_kind' => $kind,
            'amount_cents' => $cents,
            'transaction_id' => $tx,
            'description' => $this->pick($descs),
            'recorded_by' => $this->u['account_manager'],
            'recorded_at' => $this->ts($this->daysAgo($this->randInt(2, $maxAgo))),
            'verified_by' => $this->rand() < $verifyOdds ? $this->u['head_accountant'] : null,
            'verified_at' => $this->rand() < $verifyOdds ? $this->ts($this->daysAgo($this->randInt(1, $maxVerifyAgo))) : null,
        ];
        $n = count($txIds);
        foreach (DB::table('payment_records')->whereNotNull('verified_by')->get() as $payment) {
            $entries[] = [
                'entry_kind' => 'revenue', 'amount_cents' => (int) round((float) $payment->amount * 100),
                'transaction_id' => $payment->transaction_id,
                'description' => match ($payment->payment_kind) {
                    'downpayment' => 'Vehicle downpayment', 'installment' => 'Monthly vehicle installment', default => 'Vehicle sale proceeds',
                },
                'recorded_by' => $payment->recorded_by, 'recorded_at' => $payment->paid_at,
                'verified_by' => $payment->verified_by, 'verified_at' => $payment->paid_at,
            ];
        }
        for ($i = 0; $i < 14; $i++) {
            $entries[] = $entry('expense', $this->randInt(2000, 120000) * 100, $txIds[($i + 3) % $n], ['Reconditioning parts', 'Fuel and transport', 'Advertising expense', 'Vehicle detailing'], 0.7, 40, 30);
        }
        for ($i = 0; $i < 6; $i++) {
            $entries[] = $entry('adjustment', $this->randInt(500, 5000) * 100, null, ['Rounding adjustment', 'Prior period correction'], 0.5, 30, 20);
        }
        $this->insert('financial_entries', $entries);

        $disbursements = [];
        $events = [];
        $flows = ['submitted' => ['submitted'], 'approved' => ['submitted', 'approved'], 'released' => ['submitted', 'approved', 'released'], 'received' => ['submitted', 'approved', 'released', 'received'], 'paid' => ['submitted', 'approved', 'released', 'received', 'paid'], 'rejected' => ['submitted', 'rejected'], 'draft' => []];
        for ($i = 0; $i < 10; $i++) {
            $status = $this->pick(['submitted', 'approved', 'released', 'received', 'paid', 'rejected', 'draft']);
            $id = $this->id();
            $requester = $this->pick([$this->u['confidential_informant'], $this->u['account_manager']]);
            $disbursements[] = [
                'id' => $id,
                'title' => $this->pick(['Vehicle acquisition fund', 'Reconditioning disbursement', 'Field case allowance', 'Delivery fuel allocation']),
                'amount_cents' => $this->randInt(10000, 500000) * 100,
                'purpose' => 'Approved disbursement for operations.',
                'status' => $status,
                'requested_by' => $requester,
                'approved_by' => in_array($status, ['draft', 'submitted', 'rejected'], true) ? null : $this->u['head_accountant'],
                'released_by' => in_array($status, ['released', 'received', 'paid'], true) ? $this->u['head_accountant'] : null,
                'received_by' => in_array($status, ['received', 'paid'], true) ? $this->pick([$this->u['confidential_informant'], $this->u['account_manager']]) : null,
                'notes' => 'Fund handoff recorded without online transfer.',
            ];
            foreach ($flows[$status] as $ev) {
                $events[] = ['disbursement_id' => $id, 'event_kind' => $ev, 'actor_id' => $ev === 'submitted' ? $requester : $this->u['head_accountant'], 'notes' => "Disbursement {$ev}"];
            }
        }
        $this->insert('disbursement_requests', $disbursements);
        $this->insert('disbursement_events', $events);

        $kinds = ['attendance', 'payroll', 'disbursement', 'expense', 'revenue', 'inventory', 'sales', 'management'];
        $reports = [];
        for ($i = 0; $i < 12; $i++) {
            $kind = $kinds[$i % count($kinds)];
            $reports[] = [
                'report_kind' => $kind,
                'title' => ucfirst($kind).' report — '.$this->date($this->now->subDays($this->randInt(2, 30))),
                'description' => 'Generated from live platform records.',
                'submitted_by' => $this->pick([$this->u['account_manager'], $this->u['head_accountant']]),
                'status' => $this->pick(['submitted', 'reviewed', 'draft']),
                'period_start' => $this->date($this->now->subDays(30)),
                'period_end' => $this->date($this->now->subDays(1)),
            ];
        }
        $this->insert('reports', $reports);

        $announcements = [];
        foreach ([
            ['Company-wide: New Office Hours', 'Starting next month, office hours are 8:00 AM to 5:00 PM.', 'published'],
            ['Year-End Inventory Week', 'All hands on deck for the year-end inventory count.', 'published'],
            ['Holiday Schedule Announcement', 'Please check the holiday calendar for upcoming closures.', 'published'],
            ['New Payroll Schedule', 'Payslips will be released on the 15th and 30th of each month.', 'draft'],
            ['Safety Reminder', 'Always log duty checks before closing the lot.', 'expired'],
            ['Welcome Our New Mechanics', 'Please welcome our two newest mechanics joining the team.', 'published'],
        ] as [$title, $body, $status]) {
            $announcements[] = [
                'title' => $title,
                'body' => $body,
                'status' => $status,
                'author_id' => $this->u['ceo'],
                'published_at' => match ($status) {
                    'published' => $this->ts($this->daysAgo($this->randInt(2, 20))),
                    'expired' => $this->ts($this->daysAgo(40)),
                    default => null,
                },
                'expires_at' => $status === 'expired' ? $this->ts($this->daysAgo(10))
                    : ($status === 'published' && $this->rand() < 0.4 ? $this->ts($this->now->addDays(30)) : null),
            ];
        }
        $this->insert('announcements', $announcements);
    }

    // ---------------------------------------------------------------- 11. payroll

    private function seedPayroll(): void
    {
        $staff = [['mechanic', 18000], ['sales_manager', 26000], ['marketing_specialist', 22000], ['account_manager', 30000], ['head_accountant', 32000], ['confidential_informant', 20000], ['ceo', 60000], ['head_security', 16000]];

        $this->insert('staff_compensation', array_map(fn ($s) => [
            'employee_id' => $this->u[$s[0]],
            'base_salary_cents' => $s[1] * 100,
            'effective_from' => '2026-01-01',
            'effective_until' => null,
            'created_by' => $this->u['account_manager'],
        ], $staff));

        $runs = [];
        foreach ([['draft', 30, 1], ['draft', 60, 31], ['approved', 90, 61], ['finalized', 120, 91]] as [$status, $startAgo, $endAgo]) {
            $runs[] = [
                'id' => $this->id(),
                'period_start' => $this->date($this->now->subDays($startAgo)),
                'period_end' => $this->date($this->now->subDays($endAgo)),
                'status' => $status,
                'prepared_by' => $this->u['account_manager'],
                'total_gross_cents' => 0,
                'total_deductions_cents' => 0,
                'total_net_cents' => 0,
                'notes' => 'Seed payroll run.',
            ];
        }
        $this->insert('payroll_runs', $runs);

        $payslips = [];
        $items = [];
        foreach ($runs as $run) {
            $finalized = $run['status'] === 'finalized';
            foreach ($staff as [$key, $salary]) {
                $id = $this->id();
                $gross = $salary * 100;
                $deductions = (int) round($gross * 0.08);
                $payslips[] = [
                    'id' => $id,
                    'payroll_run_id' => $run['id'],
                    'employee_id' => $this->u[$key],
                    'gross_cents' => $gross,
                    'deductions_cents' => $deductions,
                    'net_cents' => $gross - $deductions,
                    'status' => $finalized ? 'finalized' : 'draft',
                    'finalized_at' => $finalized ? $this->ts($this->daysAgo(85)) : null,
                    'payment_status' => $finalized ? $this->pick(['pending', 'paid']) : 'pending',
                ];
                foreach ([
                    ['earning', 'Base salary', $gross, (string) $gross, 'Monthly base salary '.number_format($salary)],
                    ['deduction', 'SSS contribution', (int) round($gross * 0.04), 'standard', '4% employee share'],
                    ['deduction', 'PhilHealth', (int) round($gross * 0.02), 'standard', '2% employee share'],
                    ['deduction', 'Withholding tax', (int) round($gross * 0.02), 'entered', 'Entered by Account Manager'],
                ] as [$kind, $label, $cents, $source, $note]) {
                    $items[] = ['payslip_id' => $id, 'item_kind' => $kind, 'label' => $label, 'amount_cents' => $cents, 'source_value' => $source, 'calculation_note' => $note];
                }
            }
        }
        $this->insert('payslips', $payslips);
        $this->insert('payslip_items', $items);

        $approvals = [];
        foreach ($runs as $run) {
            if (in_array($run['status'], ['approved', 'finalized'], true)) {
                $approvals[] = ['payroll_run_id' => $run['id'], 'sequence' => 1, 'reviewer_id' => $this->u['head_accountant'], 'decision' => 'approved', 'notes' => 'Reviewed by Head Accountant'];
                $approvals[] = ['payroll_run_id' => $run['id'], 'sequence' => 2, 'reviewer_id' => $this->u['ceo'], 'decision' => 'approved', 'notes' => 'Approved by CEO'];
            }
        }
        $this->insert('payroll_approvals', $approvals);
    }

    // ---------------------------------------------------------------- 12. security duty checks, roadmap

    private function seedOps(): void
    {
        $duties = [];
        $security = $this->u['head_security'];
        for ($d = 24; $d >= 1; $d--) {
            $day = $this->now->subDays($d)->setTimezone('Asia/Manila');
            if ($day->isSunday()) {
                continue;
            }
            $date = $day->format('Y-m-d');
            $duties[] = [
                'security_id' => $security,
                'duty_date' => $date,
                'before_image_path' => "security/{$security}/{$date}/before.png",
                'after_image_path' => $this->rand() < 0.7 ? "security/{$security}/{$date}/after.png" : null,
                'notes' => 'Standard lot inspection.',
                'status' => $this->pick(['completed', 'in_progress', 'pending']),
                'completed_at' => $this->rand() < 0.7 ? $this->ts($day) : null,
            ];
        }
        $this->insert('security_duty_checks', $duties);
        $evidence = $this->makePng(320, 240, $this->hueToRgb(200), $this->hueToRgb(240));
        foreach ($duties as $duty) {
            foreach (array_filter([$duty['before_image_path'], $duty['after_image_path']]) as $path) {
                Storage::disk('local')->put('security-evidence/'.$path, $evidence);
            }
        }

        // [kind, parent index, title, status, priority, quarter, team]
        $roadmap = [
            ['initiative', null, 'Customer Experience 2026', 'in_progress', 'high', 'Q2', 'Platform'],
            ['epic', 0, 'Enhanced Vehicle Discovery', 'in_progress', 'high', 'Q2', 'Platform'],
            ['feature', 1, '360° vehicle viewer', 'completed', 'high', 'Q2', 'Platform'],
            ['feature', 1, 'Advanced search filters', 'in_progress', 'medium', 'Q3', 'Platform'],
            ['epic', 0, 'Smart Recommendations', 'planned', 'medium', 'Q3', 'Data'],
            ['feature', 4, 'Budget-based ranking', 'completed', 'medium', 'Q3', 'Data'],
            ['feature', 4, 'Accuracy feedback loop', 'planned', 'low', 'Q4', 'Data'],
            ['initiative', null, 'Operational Excellence', 'planned', 'medium', 'Q3', 'Ops'],
            ['epic', 7, 'Payroll Automation', 'in_progress', 'high', 'Q3', 'Finance'],
            ['feature', 8, 'Compensation entry UI', 'completed', 'high', 'Q3', 'Finance'],
            ['feature', 8, 'Payslip payment tracking', 'completed', 'high', 'Q3', 'Finance'],
            ['epic', 7, 'Field Operations Hub', 'planned', 'medium', 'Q4', 'Ops'],
            ['feature', 11, 'Case expense tracking', 'in_progress', 'medium', 'Q4', 'Ops'],
            ['initiative', null, 'Customer Experience', 'planned', 'medium', 'Q4', 'Sales'],
            ['epic', 13, 'Customer Portal', 'on_hold', 'low', 'Q4', 'Sales'],
            ['feature', 14, 'Customer self-service dashboard', 'on_hold', 'low', 'Q4', 'Sales'],
            ['feature', 14, 'Customer messaging', 'completed', 'medium', 'Q4', 'Sales'],
        ];
        $rows = [];
        foreach ($roadmap as [$kind, $parent, $title, $status, $priority, $quarter, $team]) {
            $rows[] = [
                'id' => $this->id(),
                'parent_id' => $parent === null ? null : $rows[$parent]['id'],
                'kind' => $kind,
                'title' => $title,
                'description' => "{$title} — tracked on the product roadmap.",
                'status' => $status,
                'priority' => $priority,
                'quarter' => $quarter,
                'year' => 2026,
                'team' => $team,
                'created_by' => $this->u['ceo'],
            ];
        }
        $this->insert('roadmap_items', $rows);
    }
}
