<?php

namespace App\Jobs;

use App\Services\FileService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Advisory OCR check of an OR/CR or a valid ID (was autoCheckDocument in src/lib/verification/verify-document.ts,
 * run with Next.js after()). The upload sets auto_check_status = 'pending'; this job sets 'verified', 'failed'
 * or 'manual_review'. No provider, no key, or a provider that keeps failing all end in 'manual_review', so a
 * person always reviews what the check could not read. Staff verification never depends on it.
 */
class CheckTransactionDocument implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public array $backoff = [30, 120];

    private const ORCR_MARKERS = ['LAND TRANSPORTATION OFFICE', 'CERTIFICATE OF REGISTRATION', 'OFFICIAL RECEIPT', 'PLATE', 'CHASSIS', 'ENGINE', 'MV FILE'];

    private const ID_MARKERS = [
        'passport' => ['PASAPORTE', 'PASSPORT'],
        'drivers_license' => ["DRIVER'S LICENSE", 'DRIVERS LICENSE', 'LAND TRANSPORTATION OFFICE'],
        'umid' => ['UNIFIED MULTI-PURPOSE', 'UMID'],
        'sss_id' => ['SOCIAL SECURITY SYSTEM', 'SSS'],
        'gsis_id' => ['GOVERNMENT SERVICE INSURANCE', 'GSIS'],
        'philhealth_id' => ['PHILHEALTH', 'PHILIPPINE HEALTH INSURANCE'],
        'voters_id' => ['COMMISSION ON ELECTIONS', 'COMELEC', 'VOTER'],
        'national_id' => ['PAMBANSANG PAGKAKAKILANLAN', 'PHILIPPINE IDENTIFICATION', 'PHILSYS'],
        'prc_id' => ['PROFESSIONAL REGULATION COMMISSION'],
        'postal_id' => ['PHILPOST', 'POSTAL'],
    ];

    /** @param  'orcr'|'valid_id'  $kind */
    public function __construct(public string $documentId, public string $kind, public ?string $idType = null) {}

    public function handle(FileService $files): void
    {
        $document = DB::table('transaction_documents')->where('id', $this->documentId)->first(['storage_path']);
        if (! $document) {
            return;
        }
        $env = $this->kind === 'orcr' ? ['ORCR_VERIFY_PROVIDER', 'ORCR_VERIFY_API_KEY'] : ['ID_VERIFY_PROVIDER', 'ID_VERIFY_API_KEY'];
        $provider = trim((string) env($env[0]));
        if ($provider === '') {
            $this->save('manual_review', null, 'No verification service is set up.');

            return;
        }
        if ($provider !== 'ocrspace') {
            $this->save('manual_review', $provider, 'Unknown verification service.');

            return;
        }
        $key = trim((string) env($env[1]));
        if ($key === '') {
            $this->save('manual_review', $provider, 'The verification service did not answer.');

            return;
        }

        // A local signed link is not reachable from OCR.space, so the bytes go up as base64.
        $path = (string) $document->storage_path;
        $bytes = $files->disk('transaction-documents')->get('transaction-documents/'.$path);
        $pdf = str_ends_with(strtolower($path), '.pdf');
        $mime = $pdf ? 'application/pdf' : ((string) (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $bytes));
        $response = Http::asForm()->timeout(30)->post('https://api.ocr.space/parse/image', array_filter([
            'apikey' => $key, 'base64Image' => "data:{$mime};base64,".base64_encode((string) $bytes),
            'OCREngine' => '2', 'scale' => 'true', 'filetype' => $pdf ? 'PDF' : null,
        ]));
        // A failed call is retried; after the last try failed() records manual review.
        $response->throw();
        if ($response->json('IsErroredOnProcessing')) {
            throw new \RuntimeException('OCR.space error: '.implode(' ', (array) $response->json('ErrorMessage')));
        }
        $text = strtoupper(implode(' ', array_map(fn ($r) => $r['ParsedText'] ?? '', (array) $response->json('ParsedResults'))));
        [$status, $detail] = $this->kind === 'orcr' ? self::judgeOrcr($text) : self::judgeId($text, $this->idType);
        $this->save($status, $provider, $detail);
    }

    public function failed(\Throwable $e): void
    {
        Log::warning('Document auto-check failed', ['document' => $this->documentId, 'error' => $e->getMessage()]);
        $this->save('manual_review', 'ocrspace', 'The verification service did not answer.');
    }

    /** @return array{0: string, 1: string} */
    public static function judgeOrcr(string $text): array
    {
        $found = array_values(array_filter(self::ORCR_MARKERS, fn ($m) => str_contains(strtoupper($text), $m)));

        return count($found) >= 3 ? ['verified', 'Looks like an OR/CR (found: '.implode(', ', $found).').'] : ['failed', 'The text does not look like an LTO OR/CR.'];
    }

    /** @return array{0: string, 1: string} */
    public static function judgeId(string $text, ?string $idType): array
    {
        $markers = ($idType ? (self::ID_MARKERS[$idType] ?? null) : null) ?? array_merge(...array_values(self::ID_MARKERS));
        $found = array_values(array_filter($markers, fn ($m) => str_contains(strtoupper($text), $m)));

        return $found ? ['verified', 'Looks like the chosen ID (found: '.implode(', ', $found).').'] : ['failed', 'The text does not match the chosen ID type.'];
    }

    private function save(string $status, ?string $provider, ?string $detail): void
    {
        DB::table('transaction_documents')->where('id', $this->documentId)->update([
            'auto_check_status' => $status, 'auto_check_provider' => $provider, 'auto_check_detail' => $detail, 'auto_checked_at' => now(),
        ]);
    }
}
