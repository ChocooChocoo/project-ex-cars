<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * One place for every stored file. A bucket is the top folder on a disk, so database `storage_path`
 * values stay the logical keys they were on Supabase. Public buckets live on the `public` disk (served
 * at {APP_URL}/storage/...); everything else is on the private `local` disk and is only reachable
 * through a short-lived signed route issued after an authorization check.
 */
class FileService
{
    /** 2 MiB, the same cap as src/lib/uploads/compress-image.ts MAX_UPLOAD_BYTES. */
    public const MAX_BYTES = 2 * 1024 * 1024;

    public const PUBLIC_BUCKETS = ['showroom-media', 'avatars'];

    public const PRIVATE_BUCKETS = [
        'transaction-documents', 'message-attachments', 'reconditioning-receipts',
        'request-attachments', 'security-evidence', 'report-evidence',
    ];

    private const IMAGES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    private const PDF = ['application/pdf' => 'pdf'];

    public function disk(string $bucket): \Illuminate\Contracts\Filesystem\Filesystem
    {
        return Storage::disk(in_array($bucket, self::PUBLIC_BUCKETS, true) ? 'public' : 'local');
    }

    /** Allowed MIME types per bucket, sniffed from the bytes, never taken from the client. */
    public function allowed(string $bucket): array
    {
        return match ($bucket) {
            'showroom-media', 'avatars' => self::IMAGES,
            default => self::IMAGES + self::PDF,
        };
    }

    /**
     * Validates and stores an upload under `{prefix}/{uuid}.{ext}`. The key is generated here; a caller can
     * never choose the path. Returns the stored key (without the bucket) and the sniffed MIME type.
     *
     * @return array{path: string, mime: string, size: int}
     */
    public function store(UploadedFile $file, string $bucket, string $prefix, string $field = 'file'): array
    {
        $this->assertBucket($bucket);
        $size = (int) $file->getSize();
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        $allowed = $this->allowed($bucket);
        if (! isset($allowed[$mime])) {
            throw ValidationException::withMessages([$field => 'Only JPG, PNG, WebP'.(isset($allowed['application/pdf']) ? ' or PDF' : '').' files are allowed.']);
        }
        if ($size > self::MAX_BYTES) {
            throw ValidationException::withMessages([$field => $mime === 'application/pdf'
                ? 'This PDF is larger than 2 MB. Upload a smaller file.'
                : 'This file is larger than 2 MB.']);
        }
        $prefix = trim($prefix, '/');
        if ($prefix === '' || str_contains($prefix, '..')) {
            throw new \InvalidArgumentException('Invalid storage prefix.');
        }
        $path = $prefix.'/'.Str::uuid().'.'.$allowed[$mime];
        $this->disk($bucket)->putFileAs($bucket.'/'.dirname($path), $file, basename($path));

        return ['path' => $path, 'mime' => $mime, 'size' => $size];
    }

    public function delete(string $bucket, ?string $path): void
    {
        if ($path) {
            $this->assertBucket($bucket);
            $this->disk($bucket)->delete($bucket.'/'.$path);
        }
    }

    public function exists(string $bucket, string $path): bool
    {
        return $this->disk($bucket)->exists($bucket.'/'.$path);
    }

    public function publicUrl(string $bucket, string $path): string
    {
        return rtrim((string) config('app.url'), '/').'/storage/'.$bucket.'/'.ltrim($path, '/');
    }

    /** Expiring link to a private file. Only call this after the caller has been authorized for the record. */
    public function signedUrl(string $bucket, ?string $path, int $ttlSeconds = 3600): ?string
    {
        if (! $path) {
            return null;
        }
        $this->assertBucket($bucket);

        // Signed relative (the route checks `signed:relative`), so the link survives a proxy or host alias.
        $relative = URL::temporarySignedRoute('files.show', now()->addSeconds($ttlSeconds), ['bucket' => $bucket, 'path' => $path], absolute: false);

        return rtrim((string) config('app.url'), '/').$relative;
    }

    private function assertBucket(string $bucket): void
    {
        if (! in_array($bucket, [...self::PUBLIC_BUCKETS, ...self::PRIVATE_BUCKETS], true)) {
            throw new \InvalidArgumentException("Unknown bucket {$bucket}.");
        }
    }
}
