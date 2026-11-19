<?php

namespace Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DatabaseConfigTest extends TestCase
{
    #[Test]
    #[DataProvider('migrationCredentials')]
    public function selects_the_correct_migration_account(array $migration, array $expected): void
    {
        $server = $_SERVER;
        try {
            $_SERVER['DB_USERNAME'] = 'app_fixture';
            $_SERVER['DB_PASSWORD'] = 'app_fixture_password';
            $_SERVER['DB_MIGRATION_USERNAME'] = $migration[0];
            $_SERVER['DB_MIGRATION_PASSWORD'] = $migration[1];
            $connections = (require __DIR__.'/../../config/database.php')['connections'];
        } finally {
            $_SERVER = $server;
        }

        $this->assertSame('app_fixture', $connections['mysql']['username']);
        $this->assertSame($expected[0], $connections['mysql_migrations']['username']);
        $this->assertSame($expected[1], $connections['mysql_migrations']['password']);
    }

    public static function migrationCredentials(): array
    {
        return [
            'blank credentials use the app account' => [['', ''], ['app_fixture', 'app_fixture_password']],
            'dedicated account keeps its own credentials' => [
                ['migrator_fixture', 'migrator_fixture_password'],
                ['migrator_fixture', 'migrator_fixture_password'],
            ],
        ];
    }
}
