<?php

namespace App\Support;

/**
 * Validation rules and messages that match src/lib/validation/forms.ts, so the Next.js forms
 * show the same text whether zod or Laravel rejects the input.
 */
final class Rules
{
    public static function email(): array
    {
        return ['required', 'string', 'min:5', 'max:254', 'email'];
    }

    /** Sign-in: length only, so older passwords still work. */
    public static function password(): array
    {
        return ['required', 'string', 'min:8', 'max:128'];
    }

    /** New passwords: the four character rules of PASSWORD_RULES. */
    public static function newPassword(): array
    {
        return [...self::password(), 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/\d/', 'regex:/[!@#$%^&*()_+\-=\[\]{};\'\\\\:"|<>?,.\/`~]/'];
    }

    public static function fullName(): array
    {
        return ['required', 'string', 'min:1', 'max:100'];
    }

    public static function messages(string $passwordField = 'password'): array
    {
        return [
            'email.min' => 'Email must be at least 5 characters.',
            'email.max' => 'Email must be at most 254 characters.',
            'email.email' => 'Please enter a valid email address.',
            "{$passwordField}.min" => 'Password must be at least 8 characters.',
            "{$passwordField}.max" => 'Password must be at most 128 characters.',
            // Laravel reports one regex message per field; the frontend lists the individual rules.
            "{$passwordField}.regex" => 'Use an uppercase letter, a lowercase letter, a number and a special character.',
            'full_name.required' => 'Name is required.',
            'full_name.max' => 'Name must be at most 100 characters.',
        ];
    }
}
