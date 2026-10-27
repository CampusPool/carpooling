<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mobility_commute_profiles', fn ($t) => $t->foreign('user_id', 'mobility_commute_profiles_user_fk')->references('id')->on('users')->restrictOnDelete());
        Schema::table('mobility_commute_demo_actors', fn ($t) => $t->foreign('user_id', 'mobility_commute_demo_actors_user_fk')->references('id')->on('users')->restrictOnDelete());
        Schema::table('mobility_commute_demo_trips', function ($t): void {
            $t->index('audience_id', 'mobility_commute_demo_trips_audience_idx');
            $t->foreign('trip_id', 'mobility_commute_demo_trips_trip_fk')->references('id')->on('trips')->restrictOnDelete();
            $t->foreign('audience_id', 'mobility_commute_demo_trips_audience_fk')->references('id')->on('users')->restrictOnDelete();
        });
        Schema::table('mobility_commute_demo_wallets', fn ($t) => $t->foreign('user_id', 'mobility_commute_demo_wallets_user_fk')->references('id')->on('users')->restrictOnDelete());
        Schema::table('mobility_commute_demo_holds', function ($t): void {
            $t->index('rider_id', 'mobility_commute_demo_holds_rider_idx');
            $t->index('driver_id', 'mobility_commute_demo_holds_driver_idx');
            $t->foreign('booking_id', 'mobility_commute_demo_holds_booking_fk')->references('id')->on('trip_passengers')->restrictOnDelete();
            $t->foreign('rider_id', 'mobility_commute_demo_holds_rider_fk')->references('id')->on('users')->restrictOnDelete();
            $t->foreign('driver_id', 'mobility_commute_demo_holds_driver_fk')->references('id')->on('users')->restrictOnDelete();
        });
        Schema::table('mobility_commute_demo_entries', function ($t): void {
            $t->index('user_id', 'mobility_commute_demo_entries_user_idx');
            $t->index('booking_id', 'mobility_commute_demo_entries_booking_idx');
            $t->foreign('user_id', 'mobility_commute_demo_entries_user_fk')->references('id')->on('users')->restrictOnDelete();
            $t->foreign('booking_id', 'mobility_commute_demo_entries_booking_fk')->references('id')->on('trip_passengers')->restrictOnDelete();
        });
        Schema::table('mobility_commute_receipts', fn ($t) => $t->foreign('user_id', 'mobility_commute_receipts_user_fk')->references('id')->on('users')->restrictOnDelete());
        Schema::table('mobility_commute_matches', function ($t): void {
            $t->foreign('trip_id', 'mobility_commute_matches_trip_fk')->references('id')->on('trips')->restrictOnDelete();
            $t->foreign('rider_id', 'mobility_commute_matches_rider_fk')->references('id')->on('users')->restrictOnDelete();
        });
        Schema::table('mobility_commute_booking_terms', function ($t): void {
            $t->foreign('booking_id', 'mobility_commute_booking_terms_booking_fk')->references('id')->on('trip_passengers')->restrictOnDelete();
            $t->foreign('match_key', 'mobility_commute_booking_terms_match_fk')->references('match_key')->on('mobility_commute_matches')->restrictOnDelete();
        });

        DB::statement('ALTER TABLE mobility_commute_demo_trips ADD CONSTRAINT mobility_commute_demo_trips_fare_chk CHECK (fare_minor >= 0 AND base_fare_minor >= 0 AND surcharge_minor >= 0)');
        DB::statement('ALTER TABLE mobility_commute_demo_wallets ADD CONSTRAINT mobility_commute_demo_wallets_balance_chk CHECK (available_minor >= 0)');
        DB::statement('ALTER TABLE mobility_commute_demo_holds ADD CONSTRAINT mobility_commute_demo_holds_amount_chk CHECK (amount_minor >= 0)');
        DB::statement('ALTER TABLE mobility_commute_demo_entries ADD CONSTRAINT mobility_commute_demo_entries_amount_chk CHECK (amount_minor <> 0)');
        DB::statement('ALTER TABLE mobility_commute_matches ADD CONSTRAINT mobility_commute_matches_fare_chk CHECK (fare_minor >= 0 AND base_fare_minor >= 0 AND surcharge_minor >= 0)');
    }

    public function down(): void
    {
        foreach ([
            'mobility_commute_matches' => ['mobility_commute_matches_trip_fk', 'mobility_commute_matches_rider_fk'],
            'mobility_commute_booking_terms' => ['mobility_commute_booking_terms_booking_fk', 'mobility_commute_booking_terms_match_fk'],
            'mobility_commute_receipts' => ['mobility_commute_receipts_user_fk'],
            'mobility_commute_demo_entries' => ['mobility_commute_demo_entries_user_fk', 'mobility_commute_demo_entries_booking_fk'],
            'mobility_commute_demo_holds' => ['mobility_commute_demo_holds_booking_fk', 'mobility_commute_demo_holds_rider_fk', 'mobility_commute_demo_holds_driver_fk'],
            'mobility_commute_demo_wallets' => ['mobility_commute_demo_wallets_user_fk'],
            'mobility_commute_demo_trips' => ['mobility_commute_demo_trips_trip_fk', 'mobility_commute_demo_trips_audience_fk'],
            'mobility_commute_demo_actors' => ['mobility_commute_demo_actors_user_fk'],
            'mobility_commute_profiles' => ['mobility_commute_profiles_user_fk'],
        ] as $table => $constraints) {
            Schema::table($table, function ($t) use ($constraints): void {
                foreach ($constraints as $constraint) {
                    $t->dropForeign($constraint);
                }
            });
        }

        DB::statement('ALTER TABLE mobility_commute_matches DROP CHECK mobility_commute_matches_fare_chk');
        DB::statement('ALTER TABLE mobility_commute_demo_entries DROP CHECK mobility_commute_demo_entries_amount_chk');
        DB::statement('ALTER TABLE mobility_commute_demo_holds DROP CHECK mobility_commute_demo_holds_amount_chk');
        DB::statement('ALTER TABLE mobility_commute_demo_wallets DROP CHECK mobility_commute_demo_wallets_balance_chk');
        DB::statement('ALTER TABLE mobility_commute_demo_trips DROP CHECK mobility_commute_demo_trips_fare_chk');

        Schema::table('mobility_commute_demo_trips', fn ($t) => $t->dropIndex('mobility_commute_demo_trips_audience_idx'));
        Schema::table('mobility_commute_demo_holds', function ($t): void {
            $t->dropIndex('mobility_commute_demo_holds_rider_idx');
            $t->dropIndex('mobility_commute_demo_holds_driver_idx');
        });
        Schema::table('mobility_commute_demo_entries', function ($t): void {
            $t->dropIndex('mobility_commute_demo_entries_user_idx');
            $t->dropIndex('mobility_commute_demo_entries_booking_idx');
        });
    }
};
