<?php

namespace Database\Seeders;

use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo dataset: PHP port of scripts/seed-data.cjs (same tables, counts, states and wording).
 * Dates are relative to now, so the demo always looks current. Values come from a fixed-seed
 * RNG, so every run gives the same data apart from UUIDs and the clock.
 *
 * Supabase triggers that filled columns (viewing_arrangements.vehicle_id) are done here explicitly.
 */
class DemoDataSeeder extends Seeder
{
    /** @var array<string, string> */
    private array $u;

    private CarbonImmutable $now;

    /** @param array<string, string> $users key => user id, from UserSeeder */
    public function run(array $users): void
    {
        $this->u = $users;
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
        ['Suzuki', 'Swift', 2022, 25000, 'Excellent', 'Hatchback', 'Gasoline', 'Automatic'],
        ['Hyundai', 'Accent', 2020, 62000, 'Good', 'Sedan', 'Diesel', 'Manual'],
        ['Kia', 'Stonic', 2022, 20000, 'Excellent', 'SUV', 'Gasoline', 'Automatic'],
        ['Isuzu', 'mu-X', 2021, 47000, 'Good', 'SUV', 'Diesel', 'Automatic'],
        ['Mazda', 'CX-5', 2021, 39000, 'Excellent', 'SUV', 'Gasoline', 'Automatic'],
        ['MG', 'ZS', 2023, 6000, 'Excellent', 'SUV', 'Gasoline', 'CVT'],
        ['Geely', 'Coolray', 2022, 17000, 'Excellent', 'SUV', 'Gasoline', 'DCT'],
        ['Nissan', 'Navara', 2019, 88000, 'Fair', 'Pickup', 'Diesel', 'Manual'],
        ['Ford', 'Fiesta', 2018, 102000, 'Fair', 'Hatchback', 'Gasoline', 'Manual'],
        ['Toyota', 'Corolla Altis', 2019, 74000, 'Good', 'Sedan', 'Gasoline', 'CVT'],
        ['Honda', 'Accord', 2018, 91000, 'Good', 'Sedan', 'Gasoline', 'CVT'],
        ['Mitsubishi', 'Outlander', 2020, 57000, 'Good', 'SUV', 'Gasoline', 'CVT'],
    ];

    private const LISTING_POOL = [
        'available', 'available', 'available', 'available', 'available', 'available', 'available', 'available',
        'available', 'available', 'available', 'available', 'reserved', 'reserved', 'reserved', 'reserved',
        'sold', 'sold', 'sold', 'sold', 'sold', 'sold', 'draft', 'draft', 'draft', 'draft',
        'awaiting_price_approval', 'inspecting', 'repairing', 'archived',
    ];

    private const PRICE_POOL = [
        548000, 1250000, 1180000, 1680000, 1180000, 798000, 1080000, 1580000, 698000, 1380000, 1280000, 698000, 898000,
        1480000, 1780000, 748000, 1480000, 898000, 798000, 648000, 1180000, 1580000, 1680000, 1080000, 1180000, 980000,
        598000, 998000, 1180000, 1280000,
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
                'engine' => $this->pick(['1.3L', '1.5L', '1.6L', '2.0L', '2.4L', '2.5L', '2.8L', '3.0L']),
                'description' => "{$year} {$make} {$model} in ".strtolower($condition)." condition. {$bodyType} with ".strtolower($transmission).' transmission. Well-maintained and ready for the road.',
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

        return array_map(fn ($r) => ['id' => $r['id'], 'listing_state' => $r['listing_state']], $rows);
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
        // Every seeded path points to a real file (Phase 4): one sample PDF fixture, private disk.
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
        for ($i = 0; $i < 20; $i++) {
            $isBuyNow = $i % 3 === 0;
            $state = $this->pick(['open', 'assigned', 'scheduled', 'handed_off', 'closed']);
            $inquiries[] = [
                'id' => $this->id(),
                'customer_id' => $this->u['customer'],
                'vehicle_id' => $vehicles[$i % count($vehicles)]['id'],
                'intention_kind' => $isBuyNow ? 'buy_now' : 'inquiry',
                'assigned_account_manager' => ! $isBuyNow && $state !== 'open' ? $this->u['account_manager'] : null,
                'assigned_sales_manager' => $isBuyNow && $state !== 'open' ? $this->u['sales_manager'] : null,
                'handoff_state' => $state === 'handed_off' ? 'handed_off' : ($state === 'closed' ? $this->pick(['none', 'handed_off']) : 'none'),
                'state' => $state,
            ];
        }
        $this->insert('inquiries', $inquiries);

        $customerLines = ['Hello, is this vehicle still available?', 'What is the final price?', 'Can I schedule a viewing this week?', 'Is financing available for this unit?', 'What is the mileage and condition?', 'Are the service records available?', 'Can you deliver to Cavite?', 'What warranty comes with this?'];
        $staffLines = ['Good day! Yes, the vehicle is still available.', 'The final price is negotiable. We can discuss in person.', 'We can schedule a viewing — when works best for you?', 'Financing is available with flexible terms.', 'Full service records are available for review.', 'Delivery within CALABARZON can be arranged.', 'The unit comes with a 6-month warranty.', 'We can hold the unit with a reservation fee.'];
        $messages = [];
        foreach ($inquiries as $inquiry) {
            $turns = $this->randInt(3, 9);
            $sender = $this->u['customer'];
            for ($t = 0; $t < $turns; $t++) {
                $isCustomer = $sender === $this->u['customer'];
                $messages[] = [
                    'id' => $this->id(),
                    'inquiry_id' => $inquiry['id'],
                    'sender_id' => $sender,
                    'message_text' => $this->pick($isCustomer ? $customerLines : $staffLines),
                    // Never in the future (the Supabase seed could produce future-dated messages).
                    'sent_at' => $this->ts($this->daysAgo($this->randInt(1, 14))->addDays($t)->min($this->now)),
                    'read_at' => $this->rand() < 0.7 ? $this->ts($this->daysAgo($this->randInt(1, 14))->addDays($t)) : null,
                ];
                $sender = $isCustomer ? ($this->rand() < 0.7 ? $this->u['account_manager'] : $this->u['sales_manager']) : $this->u['customer'];
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
                'uploader_id' => $this->u['customer'],
            ];
        }
        $this->insert('message_attachments', $attachments);

        $reports = [];
        for ($i = 0; $i < 3; $i++) {
            $reports[] = [
                'reported_message_id' => $messages[$i * 5]['id'] ?? null,
                'reported_inquiry_id' => $inquiries[$i]['id'],
                'reporter_id' => $this->u['customer'],
                'reason' => $this->pick(['Spam message', 'Inappropriate language', 'Suspicious offer']),
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
        $buyVehicles = array_slice($vehicles, 12, 12);
        $buyStates = ['pending', 'under_review', 'approved', 'completed', 'completed', 'cancelled', 'pending', 'approved', 'completed', 'under_review', 'approved', 'pending'];
        $txRows = [];
        foreach ($buyStates as $i => $state) {
            $id = $this->id();
            $txRows[] = $this->txRow($id, 'buy', $state, $buyVehicles[$i]['id']);
            $created[] = ['id' => $id, 'kind' => 'buy', 'state' => $state];
        }
        for ($i = 0; $i < 6; $i++) {
            $id = $this->id();
            $state = $this->pick(['pending', 'under_review', 'approved', 'rejected', 'completed']);
            $txRows[] = $this->txRow($id, 'sell', $state, null);
            $created[] = ['id' => $id, 'kind' => 'sell', 'state' => $state];
        }
        $this->insert('transactions', $txRows);

        $history = [];
        $flows = ['pending' => ['pending', 'under_review'], 'under_review' => ['under_review', 'approved'], 'approved' => ['approved', 'completed'], 'rejected' => ['pending', 'rejected'], 'completed' => ['pending', 'under_review', 'approved', 'completed'], 'cancelled' => ['pending', 'cancelled']];
        foreach ($created as $t) {
            $prev = 'pending';
            foreach ($flows[$t['state']] ?? ['pending'] as $s) {
                if ($s === $prev && $s !== 'pending') {
                    continue;
                }
                $history[] = [
                    'transaction_id' => $t['id'],
                    'from_state' => $prev,
                    'to_state' => $s,
                    'actor_id' => in_array($s, ['completed', 'approved'], true) ? $this->u['sales_manager'] : $this->u['customer'],
                    'reason' => $this->pick(['Created by customer', 'Under staff review', 'Approved after review', 'Transaction completed', 'Cancelled by customer']),
                    'changed_at' => $this->ts($this->daysAgo($this->randInt(1, 45))),
                ];
                $prev = $s;
            }
        }
        $this->insert('transaction_status_history', $history);

        $buyTxs = array_values(array_filter($created, fn ($t) => $t['kind'] === 'buy'));
        $purchases = [];
        foreach ($buyTxs as $t) {
            $method = $this->pick(['cash', 'financing', 'bank_transfer']);
            $done = $t['state'] === 'completed';
            $purchases[] = [
                'transaction_id' => $t['id'],
                'payment_method' => $method,
                'final_price' => $this->randInt(500000, 1800000),
                'arrangement_kind' => $this->pick(['delivery', 'meetup', 'gce_visit']),
                'location' => $this->pick(['GCE Office, Dasmariñas', 'SM Mall of Asia', 'Tagaytay', 'Bacoor, Cavite']),
                'document_check_state' => $done ? 'verified' : $this->pick(['pending', 'verified']),
                'checked_by' => $done ? $this->u['sales_manager'] : null,
                'checked_at' => $done ? $this->ts($this->daysAgo($this->randInt(1, 9))) : null,
                'payment_option' => $method === 'financing' ? 'financing' : 'full',
            ];
        }
        $this->insert('purchase_details', $purchases);

        $sells = [];
        foreach (array_filter($created, fn ($t) => $t['kind'] === 'sell') as $t) {
            $decided = in_array($t['state'], ['approved', 'rejected'], true);
            $sells[] = [
                'transaction_id' => $t['id'],
                'offered_amount' => $this->randInt(300000, 1500000),
                'valuation_amount' => $this->rand() < 0.6 ? $this->randInt(280000, 1400000) : null,
                'review_notes' => in_array($t['state'], ['under_review', 'approved'], true) ? 'Vehicle inspected; valuation within range.' : null,
                'decision' => $t['state'] === 'approved' ? 'accepted' : ($t['state'] === 'rejected' ? 'rejected' : null),
                'decision_maker_id' => $decided ? $this->u['sales_manager'] : null,
                'decision_date' => $decided ? $this->ts($this->daysAgo($this->randInt(1, 20))) : null,
            ];
        }
        $this->insert('sell_details', $sells);

        // Financing: up to 4 installment accounts from financing purchases.
        $accounts = [];
        $financed = array_values(array_filter($buyTxs, fn ($t, $i) => $purchases[$i]['payment_method'] === 'financing', ARRAY_FILTER_USE_BOTH));
        foreach (array_slice($financed, 0, 4) as $t) {
            $total = $this->randInt(600000, 1600000);
            $down = (int) round($total * 0.2);
            $accounts[] = [
                'id' => $this->id(),
                'purchase_transaction_id' => $t['id'],
                'financed_total' => $total,
                'down_payment' => $down,
                'opening_balance' => $total - $down,
                'start_date' => $this->date($this->daysAgo($this->randInt(30, 120))),
                'state' => $this->pick(['active', 'active', 'closed']),
                'closed_date' => $this->rand() < 0.2 ? $this->date($this->daysAgo($this->randInt(5, 30))) : null,
            ];
        }
        $this->insert('installment_accounts', $accounts);

        $installments = [];
        foreach ($accounts as $acc) {
            $count = $this->randInt(6, 12);
            $per = (int) round($acc['opening_balance'] / $count);
            $paidCount = $this->randInt(0, $count - 2);
            for ($s = 1; $s <= $count; $s++) {
                $due = $this->now->addDays(($s - $count) * 30);
                $isPaid = $s <= $paidCount;
                $isOverdue = ! $isPaid && $s === $paidCount + 1 && $this->rand() < 0.5;
                $installments[] = [
                    'id' => $this->id(),
                    'account_id' => $acc['id'],
                    'sequence_no' => $s,
                    'due_date' => $this->date($due),
                    'amount_due' => $per,
                    'state' => $isPaid ? 'paid' : ($isOverdue ? 'overdue' : 'upcoming'),
                    'payment_date' => $isPaid ? $this->date($due) : null,
                ];
            }
        }
        $this->insert('installments', $installments);

        $payments = [];
        $txOfAccount = array_column($accounts, 'purchase_transaction_id', 'id');
        foreach ($installments as $inst) {
            if ($inst['state'] === 'paid') {
                $payments[] = $this->paymentRow($txOfAccount[$inst['account_id']], $inst['id'], $inst['amount_due'], ['cash', 'bank_transfer', 'paymongo'], $inst['payment_date']);
            }
        }
        $financedIds = array_column($accounts, 'purchase_transaction_id');
        foreach (array_slice(array_values(array_filter($buyTxs, fn ($t) => ! in_array($t['id'], $financedIds, true))), 0, 6) as $t) {
            $payments[] = $this->paymentRow($t['id'], null, $this->randInt(500000, 1600000), ['cash', 'paymongo', 'bank_transfer'], $this->date($this->daysAgo($this->randInt(2, 30))));
        }
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

        $terms = [];
        foreach ($accounts as $acc) {
            $balance = $acc['opening_balance'];
            $terms[] = [
                'purchase_transaction_id' => $acc['purchase_transaction_id'],
                'arrangement_description' => 'Monthly installment arrangement with 20% down payment.',
                'total_amount' => $balance + (int) round($balance * 0.1),
                'down_payment' => (int) round($balance * 0.2),
                'number_of_payments' => $this->randInt(6, 12),
                'payment_frequency' => $this->pick(['weekly', 'monthly']),
                'first_due_date' => $this->date($this->now->addDays(30)),
                'agreed_by' => $this->u['sales_manager'],
                'approver_id' => $this->u['head_accountant'],
                'approval_date' => $this->ts($this->daysAgo($this->randInt(1, 15))),
                'state' => $this->pick(['approved', 'active']),
            ];
        }
        $this->insert('payment_terms', $terms);

        $cases = [];
        $cis = [$this->u['confidential_informant'], $this->u['confidential_informant2'], $this->u['confidential_informant3'], $this->u['confidential_informant4']];
        $mechanics = [$this->u['mechanic'], $this->u['mechanic2'], $this->u['mechanic3'], $this->u['mechanic4']];
        for ($i = 0; $i < 10; $i++) {
            $cases[] = [
                'vehicle_id' => $this->pick($vehicles)['id'],
                'transaction_id' => $created[$i % count($created)]['id'],
                'case_kind' => $this->pick(['acquisition', 'delivery', 'recovery']),
                'assigned_confidential_informant' => $this->pick($cis),
                'mechanic_id' => $this->rand() < 0.4 ? $this->pick($mechanics) : null,
                'schedule' => $this->ts($this->now->addDays($this->randInt(1, 10))),
                'location' => $this->pick(['Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon']),
                'state' => $this->pick(['assigned', 'accepted', 'in_progress', 'completed', 'cancelled']),
                'completion_date' => $this->rand() < 0.4 ? $this->ts($this->daysAgo($this->randInt(1, 12))) : null,
                'expenses_cents' => $this->rand() < 0.5 ? $this->randInt(500, 15000) * 100 : 0,
                'notes' => 'Field work assigned through the dashboard.',
            ];
        }
        $this->insert('field_cases', $cases);

        return array_column($created, 'id');
    }

    private function txRow(string $id, string $kind, string $state, ?string $vehicleId): array
    {
        return [
            'id' => $id,
            'customer_id' => $this->u['customer'],
            'transaction_kind' => $kind,
            'vehicle_id' => $vehicleId,
            'current_state' => $state,
            'created_by' => $this->u['customer'],
            'opened_at' => $this->ts($this->daysAgo($this->randInt(5, 50))),
            'completed_at' => $state === 'completed' ? $this->ts($this->daysAgo($this->randInt(1, 10))) : null,
        ];
    }

    private function paymentRow(string $txId, ?string $installmentId, int $amount, array $methods, string $settled): array
    {
        return [
            'transaction_id' => $txId,
            'installment_id' => $installmentId,
            'amount' => $amount,
            'method' => $this->pick($methods),
            'external_reference' => sprintf('REF-%05d', (int) floor($this->rand() * 100000)),
            'recorded_by' => $this->u['head_accountant'],
            'verified_by' => $this->rand() < 0.8 ? $this->u['head_accountant'] : null,
            'settlement_date' => $settled,
        ];
    }

    // ---------------------------------------------------------------- 8. favourites, content, recommendations

    private function seedFavourites(array $vehicles): void
    {
        $rows = [];
        foreach ($vehicles as $v) {
            if ($v['listing_state'] === 'available' && count($rows) < 30) {
                $rows[] = ['customer_id' => $this->u['customer'], 'vehicle_id' => $v['id']];
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
        $budgets = [800000, 1000000, 1200000, 1500000, 700000, 900000];
        $prefs = ['Sedan, automatic, low mileage', 'SUV, diesel, good condition', 'Pickup for business use', 'Family MPV, automatic', 'Fuel-efficient hatchback', 'Reliable commuter sedan'];
        $runs = [];
        foreach ($budgets as $i => $budget) {
            $runs[] = [
                'id' => $this->id(),
                'customer_id' => $this->u['customer'],
                'budget' => $budget,
                'stated_preferences' => $prefs[$i],
                'criteria_version' => '1.0',
                'run_date' => $this->ts($this->daysAgo($this->randInt(2, 40))),
            ];
        }
        $this->insert('recommendation_runs', $runs);

        $eligible = array_slice(array_values(array_filter($vehicles, fn ($v) => $v['listing_state'] === 'available')), 0, 8);
        $results = [];
        foreach ($runs as $run) {
            foreach ($eligible as $rank => $v) {
                $base = 100 - $rank * 6 - $this->randInt(0, 4);
                $results[] = [
                    'run_id' => $run['id'],
                    'vehicle_id' => $v['id'],
                    'budget_score' => max(55, $base - $this->randInt(0, 8)),
                    'condition_score' => max(55, $base - $this->randInt(0, 6)),
                    'fuel_score' => max(55, $base - $this->randInt(0, 10)),
                    'demand_score' => max(55, $base - $this->randInt(0, 8)),
                    'mileage_score' => max(55, $base - $this->randInt(0, 12)),
                    'total_score' => $base,
                    'rank' => $rank + 1,
                ];
            }
        }
        $this->insert('recommendation_results', $results);

        $feedback = [];
        foreach ($runs as $i => $run) {
            $feedback[] = [
                'run_id' => $run['id'],
                'selected_vehicle_id' => $vehicles[$i % count($vehicles)]['id'],
                'helpful_state' => $this->pick(['helpful', 'helpful', 'not_helpful', 'unknown']),
                'outcome' => $this->pick(['Contacted seller', 'Purchased vehicle', 'Still comparing options', null]),
                'feedback_date' => $this->ts($this->daysAgo($this->randInt(1, 30))),
            ];
        }
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
        for ($i = 0; $i < 18; $i++) {
            $entries[] = $entry('revenue', $this->randInt(500000, 1800000) * 100, $txIds[$i % $n], ['Vehicle sale proceeds', 'Reservation fee', 'Trade-in valuation adjustment'], 0.7, 40, 30);
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
