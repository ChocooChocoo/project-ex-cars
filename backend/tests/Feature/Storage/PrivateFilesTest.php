<?php

namespace Tests\Feature\Storage;

use App\Services\FileService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\Feature\Catalogue\CatalogueTest;
use Tests\TestCase;

/** FileService and the signed private-file route (Phase 4). */
class PrivateFilesTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    private function files(): FileService
    {
        return app(FileService::class);
    }

    #[Test]
    public function content_is_sniffed_not_trusted_from_the_name_or_client_type(): void
    {
        $fake = UploadedFile::fake()->createWithContent('photo.jpg', "MZ\x90\x00 not an image");
        $this->expectException(ValidationException::class);
        $this->files()->store($fake, 'message-attachments', 'inq');
    }

    #[Test]
    public function oversized_pdfs_are_rejected_and_pdfs_stay_out_of_image_only_buckets(): void
    {
        $pdf = file_get_contents(database_path('seeders/files/sample-document.pdf'));
        $big = UploadedFile::fake()->createWithContent('big.pdf', $pdf.str_repeat(' ', FileService::MAX_BYTES));
        try {
            $this->files()->store($big, 'transaction-documents', 'tx');
            $this->fail('oversized PDF accepted');
        } catch (ValidationException $e) {
            $this->assertStringContainsString('larger than 2 MB', $e->getMessage());
        }
        $this->expectException(ValidationException::class);
        $this->files()->store(UploadedFile::fake()->createWithContent('a.pdf', $pdf), 'showroom-media', 'car');
    }

    #[Test]
    public function the_server_picks_the_key_and_a_forged_path_is_ignored(): void
    {
        $user = $this->account('customer');
        $png = UploadedFile::fake()->createWithContent('../../etc/passwd.png', CatalogueTest::png());
        $this->as($user)->post('/api/v1/me/avatar', ['avatar' => $png, 'path' => 'other-user/evil.png'], ['Accept' => 'application/json'])->assertOk();

        $url = DB::table('profiles')->where('id', $user->id)->value('avatar_url');
        $this->assertMatchesRegularExpression('#/storage/avatars/'.$user->id.'/[0-9a-f-]{36}\.png$#', $url);
        $this->assertSame([], Storage::disk('public')->allFiles('avatars/other-user'));
        $this->assertCount(1, Storage::disk('public')->allFiles("avatars/{$user->id}"));

        // Replacing the photo removes the old file; removing clears it.
        $this->as($user)->post('/api/v1/me/avatar', ['avatar' => UploadedFile::fake()->createWithContent('b.png', CatalogueTest::png())], ['Accept' => 'application/json'])->assertOk();
        $this->assertCount(1, Storage::disk('public')->allFiles("avatars/{$user->id}"));
        $this->as($user)->deleteJson('/api/v1/me/avatar')->assertOk()->assertJsonPath('profile.avatar_url', null);
        $this->assertCount(0, Storage::disk('public')->allFiles("avatars/{$user->id}"));
    }

    #[Test]
    public function private_files_need_a_valid_unexpired_signature(): void
    {
        Storage::disk('local')->put('message-attachments/inq/photo.png', CatalogueTest::png());
        $url = $this->files()->signedUrl('message-attachments', 'inq/photo.png', 60);
        $path = parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY);

        $this->get($path)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->get(str_replace('signature=', 'signature=0', $path))->assertForbidden();
        $this->get(str_replace('inq/photo.png', 'inq/other.png', $path))->assertForbidden();
        $this->get('/api/v1/files/message-attachments/inq/photo.png')->assertForbidden();

        $this->travel(2)->minutes();
        $this->get($path)->assertForbidden();
    }

    #[Test]
    public function public_buckets_are_not_served_by_the_private_route(): void
    {
        Storage::disk('public')->put('avatars/x/a.png', CatalogueTest::png());
        $url = $this->files()->signedUrl('avatars', 'x/a.png');
        $this->get(parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY))->assertNotFound();
        // The private disk lives outside the web root that `storage:link` exposes.
        $this->assertStringNotContainsString('app'.DIRECTORY_SEPARATOR.'public', config('filesystems.disks.local.root'));
    }

    #[Test]
    public function every_seeded_file_record_points_to_an_existing_file(): void
    {
        $this->seed(DatabaseSeeder::class);
        $checks = [
            ['vehicle_media', 'storage_path', 'showroom-media'],
            ['message_attachments', 'storage_path', 'message-attachments'],
            ['vehicle_document_items', 'storage_path', 'transaction-documents'],
            ['transaction_documents', 'storage_path', 'transaction-documents'],
            ['security_duty_checks', 'before_image_path', 'security-evidence'],
            ['security_duty_checks', 'after_image_path', 'security-evidence'],
            ['reconditioning_parts', 'photo_path', 'reconditioning-receipts'],
            ['reconditioning_fund_receipts', 'storage_path', 'reconditioning-receipts'],
            ['employee_request_attachments', 'storage_path', 'request-attachments'],
        ];
        $checked = 0;
        foreach ($checks as [$table, $column, $bucket]) {
            foreach (DB::table($table)->whereNotNull($column)->pluck($column) as $path) {
                $this->assertTrue($this->files()->exists($bucket, $path), "{$table}.{$column} {$path}");
                $checked++;
            }
        }
        $this->assertGreaterThan(50, $checked);
        foreach (DB::table('profiles')->whereNotNull('avatar_url')->pluck('avatar_url') as $url) {
            $this->assertStringStartsWith($this->files()->publicUrl('avatars', ''), $url);
        }
    }
}
