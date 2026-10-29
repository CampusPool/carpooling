<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A booking interval's trip is duplicated for efficient inventory
        // queries. Make the duplication safe at the storage boundary: both
        // columns must identify the same trip_passengers row.
        Schema::table('trip_passengers', function (Blueprint $table): void {
            $table->unique(['id', 'trip_id'], 'trip_passengers_id_trip_id_unique');
        });

        // Likewise, an interval may only refer to a match reference created
        // for that same trip. A single-column FK allowed cross-trip links.
        Schema::table('mobility_match_references', function (Blueprint $table): void {
            $table->unique(['id', 'trip_id'], 'mobility_match_references_id_trip_id_unique');
        });

        Schema::table('mobility_booking_intervals', function (Blueprint $table): void {
            $table->dropForeign('mobility_booking_intervals_booking_id_foreign');
            $table->dropForeign('mobility_booking_intervals_match_reference_id_foreign');
            $table->foreign(['booking_id', 'trip_id'], 'mobility_booking_intervals_booking_trip_foreign')
                ->references(['id', 'trip_id'])->on('trip_passengers')->restrictOnDelete();
            $table->foreign(['match_reference_id', 'trip_id'], 'mobility_booking_intervals_match_trip_foreign')
                ->references(['id', 'trip_id'])->on('mobility_match_references')->restrictOnDelete();
        });

        Schema::table('mobility_match_references', function (Blueprint $table): void {
            $table->dropForeign('mobility_match_references_booking_id_foreign');
            $table->foreign(['booking_id', 'trip_id'], 'mobility_match_references_booking_trip_foreign')
                ->references(['id', 'trip_id'])->on('trip_passengers')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mobility_match_references', function (Blueprint $table): void {
            $table->dropForeign('mobility_match_references_booking_trip_foreign');
            $table->foreign('booking_id', 'mobility_match_references_booking_id_foreign')
                ->references('id')->on('trip_passengers')->restrictOnDelete();
        });

        Schema::table('mobility_booking_intervals', function (Blueprint $table): void {
            $table->dropForeign('mobility_booking_intervals_booking_trip_foreign');
            $table->dropForeign('mobility_booking_intervals_match_trip_foreign');
            $table->foreign('booking_id', 'mobility_booking_intervals_booking_id_foreign')
                ->references('id')->on('trip_passengers')->restrictOnDelete();
            $table->foreign('match_reference_id', 'mobility_booking_intervals_match_reference_id_foreign')
                ->references('id')->on('mobility_match_references')->restrictOnDelete();
        });

        Schema::table('mobility_match_references', function (Blueprint $table): void {
            $table->dropUnique('mobility_match_references_id_trip_id_unique');
        });
        Schema::table('trip_passengers', function (Blueprint $table): void {
            $table->dropUnique('trip_passengers_id_trip_id_unique');
        });
    }
};
