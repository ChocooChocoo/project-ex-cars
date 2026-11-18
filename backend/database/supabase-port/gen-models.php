<?php
// Generate one Eloquent model per GCE table (casts + belongsTo per FK) from the PGlite replay JSON.
// Usage: php gen-models.php <backend dir>
$backend = $argv[1];
require "$backend/vendor/autoload.php";

use Illuminate\Support\Str;

$cols = json_decode(file_get_contents(__DIR__.'/columns.json'), true);
$cons = json_decode(file_get_contents(__DIR__.'/constraints.json'), true);

$override = ['vehicle_media' => 'VehicleMedia', 'payment_reminders_sent' => 'PaymentReminderSent', 'transaction_status_history' => 'TransactionStatusHistory', 'customer_standing' => 'CustomerStanding', 'staff_compensation' => 'StaffCompensation'];
$class = fn (string $t) => $t === 'users' ? 'User' : ($override[$t] ?? Str::studly(Str::singular($t)));

$tables = [];
foreach ($cols as $c) {
    $tables[$c['t']][] = $c;
}

$written = 0;
foreach ($tables as $table => $columns) {
    $name = $class($table);
    $byName = array_column($columns, null, 'c');
    $pk = null;
    $fks = [];
    foreach ($cons as $k) {
        if ($k['t'] !== $table) {
            continue;
        }
        if ($k['type'] === 'p') {
            preg_match('/\((.*)\)/', $k['def'], $m);
            $pk = array_map('trim', explode(',', $m[1]));
        }
        if ($k['type'] === 'f') {
            preg_match('/^FOREIGN KEY \((\w+)\) REFERENCES (\S+)\((\w+)\)/', $k['def'], $m);
            $fks[] = ['col' => $m[1], 'table' => str_replace(['auth.', 'public.', 'private.'], '', $m[2]), 'owner' => $m[3]];
        }
    }
    $fks[] = null; // sentinel removed below
    array_pop($fks);

    $uses = ['Illuminate\Database\Eloquent\Model'];
    $traits = [];
    $props = ["    protected \$table = '$table';"];

    if (count($pk) > 1) {
        // Composite key: Eloquent has no composite primary keys; query it with where() on both columns.
        $props[] = '    protected $primaryKey = null;';
        $props[] = '    public $incrementing = false;';
    } elseif ($pk[0] === 'id' && $byName['id']['udt'] === 'uuid' && $byName['id']['d'] === 'gen_random_uuid()') {
        $uses[] = 'Illuminate\Database\Eloquent\Concerns\HasUuids';
        $traits[] = 'HasUuids';
    } else {
        if ($pk[0] !== 'id') {
            $props[] = "    protected \$primaryKey = '{$pk[0]}';";
        }
        $props[] = "    protected \$keyType = 'string';";
        $props[] = '    public $incrementing = false;';
    }

    $hasCreated = isset($byName['created_at']);
    $hasUpdated = isset($byName['updated_at']);
    if ($hasCreated && ! $hasUpdated) {
        $props[] = '    const UPDATED_AT = null;';
    } elseif (! $hasCreated && $hasUpdated) {
        $props[] = '    const CREATED_AT = null;';
    } elseif (! $hasCreated && ! $hasUpdated) {
        $props[] = '    public $timestamps = false;';
    }

    $casts = [];
    foreach ($columns as $c) {
        $cast = match ($c['udt']) {
            'numeric' => 'decimal:'.($c['sc'] ?? 2),
            'int2', 'int4', 'int8' => 'integer',
            'float8' => 'float',
            'bool' => 'boolean',
            'timestamptz' => 'immutable_datetime',
            'date' => 'date:Y-m-d',
            'jsonb', '_int2' => 'array',
            default => null,
        };
        if ($cast && ! in_array($c['c'], ['created_at', 'updated_at'], true)) {
            $casts[] = "            '{$c['c']}' => '$cast',";
        }
    }

    $methods = [];
    $seen = [];
    foreach ($fks as $fk) {
        $base = str_ends_with($fk['col'], '_id') && $fk['col'] !== 'id' ? substr($fk['col'], 0, -3) : $fk['col'];
        $method = $fk['col'] === 'id' ? 'user' : Str::camel($base);
        if (isset($seen[$method]) || $method === Str::camel($table)) {
            $method .= 'Record';
        }
        $seen[$method] = true;
        $related = $class($fk['table']);
        $ownerArg = $fk['owner'] === 'id' ? '' : ", '{$fk['owner']}'";
        $methods[] = "    public function {$method}(): BelongsTo\n    {\n        return \$this->belongsTo({$related}::class, '{$fk['col']}'{$ownerArg});\n    }";
    }
    if ($methods) {
        $uses[] = 'Illuminate\Database\Eloquent\Relations\BelongsTo';
    }
    sort($uses);

    $php = "<?php\n\nnamespace App\\Models;\n\n".implode("\n", array_map(fn ($u) => "use $u;", $uses))."\n\n";
    $php .= "// Generated from the final Supabase schema (table `$table`). Mass assignment stays closed until a phase adds \$fillable for its actor.\n";
    $php .= "class $name extends Model\n{\n";
    if ($traits) {
        $php .= '    use '.implode(', ', $traits).";\n\n";
    }
    $php .= implode("\n\n", $props)."\n";
    if ($casts) {
        $php .= "\n    protected function casts(): array\n    {\n        return [\n".implode("\n", $casts)."\n        ];\n    }\n";
    }
    if ($methods) {
        $php .= "\n".implode("\n\n", $methods)."\n";
    }
    $php .= "}\n";

    file_put_contents("$backend/app/Models/$name.php", $php);
    $written++;
}
echo "models written: $written\n";
