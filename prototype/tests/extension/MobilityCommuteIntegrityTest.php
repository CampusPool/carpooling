<?php

namespace Tests\Feature\Mobility;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use STS\Models\User;
use Tests\TestCase;

final class MobilityCommuteIntegrityTest extends TestCase
{
    protected function beforeRefreshingDatabase(): void
    {
        $database = DB::connection()->getDatabaseName();
        if (! preg_match('/^testing[a-zA-Z0-9_-]*$/', $database)) {
            throw new \RuntimeException('Refusing to refresh non-test database: '.$database);
        }
    }

    public function test_commute_wallet_foreign_key_rejects_orphan_users(): void
    {
        try {
            DB::table('mobility_commute_demo_wallets')->insert([
                'user_id' => 999999999,
                'available_minor' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->fail('An orphan wallet user must be rejected by MySQL.');
        } catch (QueryException) {
            $this->assertDatabaseMissing('mobility_commute_demo_wallets', ['user_id' => 999999999]);
        }
    }

    public function test_commute_wallet_check_rejects_negative_balance(): void
    {
        $user = User::factory()->create();

        try {
            DB::table('mobility_commute_demo_wallets')->insert([
                'user_id' => $user->id,
                'available_minor' => -1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->fail('A negative wallet balance must be rejected by MySQL.');
        } catch (QueryException) {
            $this->assertDatabaseMissing('mobility_commute_demo_wallets', ['user_id' => $user->id]);
        }
    }

    public function test_commute_foreign_keys_use_restricted_deletes_for_audit_history(): void
    {
        $constraint = DB::selectOne(
            'SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
            ['mobility_commute_demo_wallets_user_fk']
        );

        $this->assertNotNull($constraint);
        $this->assertSame('RESTRICT', strtoupper($constraint->DELETE_RULE));
    }
}
