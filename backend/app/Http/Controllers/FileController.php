<?php

namespace App\Http\Controllers;

use App\Services\FileService;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Serves a private file to whoever holds a valid, unexpired signature (route uses the `signed` middleware). */
class FileController extends Controller
{
    public function show(FileService $files, string $bucket, string $path): StreamedResponse
    {
        abort_unless(in_array($bucket, FileService::PRIVATE_BUCKETS, true), 404);
        abort_if(str_contains($path, '..'), 404);
        $disk = $files->disk($bucket);
        abort_unless($disk->exists("{$bucket}/{$path}"), 404);

        return $disk->response("{$bucket}/{$path}", basename($path), [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
