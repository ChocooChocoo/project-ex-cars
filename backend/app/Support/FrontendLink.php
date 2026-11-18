<?php

namespace App\Support;

final class FrontendLink
{
    /** FRONTEND_URL may list several origins (all allowed by CORS); emailed links use the first. */
    public static function base(): string
    {
        return rtrim(explode(',', (string) config('app.frontend_url'))[0], '/');
    }

    /** Link to the Next.js /auth/confirm handler carrying a relative signed API path. */
    public static function confirm(string $signedApiPath, ?string $next = null): string
    {
        $query = ['verify' => $signedApiPath] + ($next ? ['next' => $next] : []);

        return self::base().'/auth/confirm?'.http_build_query($query);
    }
}
