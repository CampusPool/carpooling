<?php

namespace Tests\Feature\Mobility;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class MobilityPrivateDispatchRollbackTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        $name = DB::connection()->getDatabaseName();
        if (! preg_match('/^testing[a-zA-Z0-9_-]*$/', $name)) {
            throw new \RuntimeException('Refusing to refresh non-test database: '.$name);
        }
    }

    public function test_rollback_refuses_null_private_rows_before_changing_either_table(): void
    {
        $extensionRoot = getenv('MOBILITY_EXTENSION_ROOT');
        $this->assertNotFalse($extensionRoot, 'Mobility extension root must be configured by the test harness.');

        Schema::disableForeignKeyConstraints();
        try {
            DB::table('mobility_dispatch_requests')->insert([
                'id' => '00000000-0000-4000-8000-000000000001',
                'rider_id' => 1,
                'quote_id' => '00000000-0000-4000-8000-000000000002',
                'quote_hash' => str_repeat('a', 64),
                'vehicle_type' => 'car',
                'pickup_point_id' => null,
                'key_hash' => str_repeat('b', 64),
                'request_hash' => str_repeat('c', 64),
                'state' => 'pending',
                'expires_at' => now()->addHour(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('mobility_dispatch_availability')->insert([
                'driver_id' => 1,
                'car_id' => 1,
                'vehicle_type' => 'car',
                'vehicle_fingerprint' => str_repeat('d', 64),
                'pickup_point_id' => null,
                'online' => false,
                'last_seen_at' => now(),
                'fresh_until' => now()->addHour(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        $migration = require rtrim($extensionRoot, '/').'/migrations/2026_10_21_000600_extend_dispatch_for_private_admission.php';

        try {
            $migration->down();
            $this->fail('Expected rollback to reject private rows without a pickup point.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('mobility_dispatch_requests', $exception->getMessage());
            $this->assertStringContainsString('pickup_point_id', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasColumn('mobility_dispatch_requests', 'dispatch_scope'));
        $this->assertTrue(Schema::hasColumn('mobility_dispatch_availability', 'dispatch_scope'));
        $this->assertTrue(Schema::hasColumn('mobility_dispatch_requests', 'private_journey_quote_id'));
        $this->assertSame(1, DB::table('mobility_dispatch_requests')->whereNull('pickup_point_id')->count());

        // Prove the second-table check also happens before either table is
        // partially reverted when the request rows themselves are compatible.
        Schema::disableForeignKeyConstraints();
        try {
            DB::table('mobility_dispatch_requests')
                ->where('id', '00000000-0000-4000-8000-000000000001')
                ->update(['pickup_point_id' => 1]);
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        try {
            $migration->down();
            $this->fail('Expected rollback to reject availability rows without a pickup point.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('mobility_dispatch_availability', $exception->getMessage());
            $this->assertStringContainsString('pickup_point_id', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasColumn('mobility_dispatch_requests', 'dispatch_scope'));
        $this->assertTrue(Schema::hasColumn('mobility_dispatch_availability', 'dispatch_scope'));
        $this->assertTrue(Schema::hasColumn('mobility_dispatch_requests', 'private_journey_quote_id'));
        $this->assertSame(0, DB::table('mobility_dispatch_requests')->whereNull('pickup_point_id')->count());
        $this->assertSame(1, DB::table('mobility_dispatch_availability')->whereNull('pickup_point_id')->count());
    }

    public function test_rollback_succeeds_with_compatible_rows_and_can_be_reapplied(): void
    {
        $extensionRoot = getenv('MOBILITY_EXTENSION_ROOT');
        $this->assertNotFalse($extensionRoot, 'Mobility extension root must be configured by the test harness.');
        $this->assertSame(0, DB::table('mobility_dispatch_requests')->whereNull('pickup_point_id')->count());
        $this->assertSame(0, DB::table('mobility_dispatch_availability')->whereNull('pickup_point_id')->count());

        $migration = require rtrim($extensionRoot, '/').'/migrations/2026_10_21_000600_extend_dispatch_for_private_admission.php';
        $migration->down();

        $this->assertFalse(Schema::hasColumn('mobility_dispatch_requests', 'dispatch_scope'));
        $this->assertFalse(Schema::hasColumn('mobility_dispatch_availability', 'dispatch_scope'));
        $this->assertFalse(Schema::hasColumn('mobility_dispatch_requests', 'private_journey_quote_id'));
        $this->assertFalse($this->isNullable('mobility_dispatch_requests', 'pickup_point_id'));
        $this->assertFalse($this->isNullable('mobility_dispatch_availability', 'pickup_point_id'));
        $this->assertSame('RESTRICT', $this->pickupDeleteAction('mobility_dispatch_requests'));
        $this->assertSame('RESTRICT', $this->pickupDeleteAction('mobility_dispatch_availability'));

        $migration->up();

        $this->assertTrue(Schema::hasColumn('mobility_dispatch_requests', 'dispatch_scope'));
        $this->assertTrue(Schema::hasColumn('mobility_dispatch_availability', 'dispatch_scope'));
        $this->assertTrue(Schema::hasColumn('mobility_dispatch_requests', 'private_journey_quote_id'));
        $this->assertTrue($this->isNullable('mobility_dispatch_requests', 'pickup_point_id'));
        $this->assertTrue($this->isNullable('mobility_dispatch_availability', 'pickup_point_id'));
    }

    private function isNullable(string $table, string $column): bool
    {
        // These identifiers are fixed in the test, and this suite uses MySQL.
        $result = DB::selectOne("SHOW COLUMNS FROM `{$table}` LIKE '{$column}'");
        $this->assertNotNull($result);
        return $result->Null === 'YES';
    }

    private function pickupDeleteAction(string $table): ?string
    {
        return DB::table('information_schema.REFERENTIAL_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $table.'_pickup_point_id_foreign')
            ->value('DELETE_RULE');
    }
}
