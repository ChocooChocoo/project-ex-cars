<?php

namespace App\Http\Controllers;

use App\Services\FileService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\URL;

/**
 * GET /api/v1/thumbnail?src=<signed private-file link>. Was the Next.js route /api/transaction-thumbnail
 * (sharp), which the static build cannot run (Phase 4b). The caller must hold a valid, unexpired signed
 * link to the original image: that link is the credential, exactly as before. Output is never cached.
 */
class ThumbnailController extends Controller
{
    private const SRC = '#^/api/v1/files/(transaction-documents|message-attachments)/([^?]+\.(?:jpe?g|png|webp))\?#i';

    private const MAX_PIXELS = 64_000_000;

    public function show(Request $request, FileService $files): Response
    {
        $src = (string) $request->query('src', '');
        if (preg_match('#^https?://#i', $src)) {
            $src = (string) preg_replace('#^https?://[^/]+#i', '', $src);
        }
        if (! preg_match(self::SRC, $src, $m) || str_contains(rawurldecode($m[2]), '..')) {
            return $this->unavailable(400);
        }
        // Same check the signed file route makes (`signed:relative`): path + query, expiry included.
        if (! URL::hasValidRelativeSignature(Request::create($src))) {
            return $this->unavailable(403);
        }
        [$bucket, $path] = [$m[1], rawurldecode($m[2])];
        if (! $files->exists($bucket, $path)) {
            return $this->unavailable(404);
        }

        $bytes = $files->disk($bucket)->get("{$bucket}/{$path}");
        $size = @getimagesizefromstring((string) $bytes);
        if (! $size || $size[0] * $size[1] > self::MAX_PIXELS) {
            return $this->unavailable(404);
        }
        $image = @imagecreatefromstring((string) $bytes);
        if (! $image) {
            return $this->unavailable(404);
        }
        $image = $this->orient($image, $bytes, $size[2]);

        // Fit inside 640x480 without enlarging or cropping (same box as the old sharp resize).
        [$w, $h] = [imagesx($image), imagesy($image)];
        $scale = min(1, 640 / $w, 480 / $h);
        $thumb = imagescale($image, max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
        ob_start();
        imagewebp($thumb, null, 75);
        $webp = (string) ob_get_clean();

        return response($webp, 200, [
            'Content-Type' => 'image/webp',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Phone photos carry their rotation in EXIF; apply it like sharp's autoOrient did. */
    private function orient(\GdImage $image, string $bytes, int $type): \GdImage
    {
        if ($type !== IMAGETYPE_JPEG || ! function_exists('exif_read_data')) {
            return $image;
        }
        $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($bytes));
        $angle = [3 => 180, 6 => -90, 8 => 90][$exif['Orientation'] ?? 1] ?? 0;

        return $angle ? imagerotate($image, $angle, 0) : $image;
    }

    private function unavailable(int $status): Response
    {
        return response('Preview unavailable', $status, ['Cache-Control' => 'private, no-store']);
    }
}
