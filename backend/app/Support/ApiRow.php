<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

/**
 * Serializes a model the way PostgREST did for the existing pages: snake_case columns, numeric columns as
 * JSON numbers, JSON columns as objects, timestamps as ISO-8601 UTC. Keeps every page's `row.column` reads
 * working without a resource class per table.
 */
final class ApiRow
{
    /** A raw DB timestamp (stored UTC) as ISO-8601, like PostgREST sent timestamptz. */
    public static function iso(mixed $value): ?string
    {
        return $value ? \Carbon\CarbonImmutable::parse($value, 'UTC')->toJSON() : null;
    }

    /** @param  list<string>|null  $only */
    public static function of(?Model $model, ?array $only = null): ?array
    {
        if (! $model) {
            return null;
        }
        $row = $model->attributesToArray();
        foreach ($model->getCasts() as $key => $cast) {
            // `decimal:N` keeps exact strings in PHP; PostgREST sent numeric as a JSON number.
            if (str_starts_with((string) $cast, 'decimal') && isset($row[$key])) {
                $row[$key] = (float) $row[$key];
            }
        }

        return $only ? Arr::only($row, $only) : $row;
    }

    /**
     * @param  iterable<Model>  $models
     * @param  list<string>|null  $only
     */
    public static function list(iterable $models, ?array $only = null): array
    {
        $rows = [];
        foreach ($models as $model) {
            $rows[] = self::of($model, $only);
        }

        return $rows;
    }
}
