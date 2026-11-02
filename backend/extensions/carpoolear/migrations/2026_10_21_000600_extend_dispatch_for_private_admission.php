<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mobility_dispatch_requests', function (Blueprint $table): void {
            $table->string('dispatch_scope', 16)->default('catalog')->after('vehicle_type');
            $table->unsignedInteger('target_driver_id')->nullable()->after('dispatch_scope');
            $table->unsignedBigInteger('pickup_point_id')->nullable()->change();
            $table->uuid('private_journey_quote_id')->nullable()->after('pickup_point_id');
            $table->string('private_source_hash', 64)->nullable()->after('private_journey_quote_id');
            $table->foreign('target_driver_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('private_journey_quote_id')->references('id')->on('mobility_private_journey_quotes')->restrictOnDelete();
            $table->index(['dispatch_scope', 'target_driver_id', 'state'], 'mob_dispatch_private_target_idx');
        });
        Schema::table('mobility_dispatch_availability', function (Blueprint $table): void {
            $table->string('dispatch_scope', 16)->default('catalog')->after('vehicle_fingerprint');
            $table->unsignedBigInteger('pickup_point_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Run this rollback with application writes quiesced. MySQL DDL is not
        // atomic, and a concurrent writer could add a NULL after this check.
        // This migration made pickup_point_id nullable for private journeys.
        // Its predecessor requires a pickup point, so check both tables before
        // any DDL: MySQL does not make this rollback atomic, and altering the
        // first table before discovering NULLs in the second leaves a partial
        // rollback. Never invent a pickup point or delete private records.
        foreach (['mobility_dispatch_requests', 'mobility_dispatch_availability'] as $table) {
            if (DB::table($table)->whereNull('pickup_point_id')->exists()) {
                throw new \RuntimeException(
                    'Cannot roll back private dispatch migration: '.$table.
                    ' contains rows without pickup_point_id. Resolve or migrate those rows with a data-preserving plan before retrying.'
                );
            }
        }

        // MySQL refuses to modify a referenced column while its foreign key is
        // attached. Drop both point constraints first, restore NOT NULL, then
        // recreate the original constraints after the type change.
        Schema::table('mobility_dispatch_availability', function (Blueprint $table): void {
            $table->dropForeign(['pickup_point_id']);
            $table->unsignedBigInteger('pickup_point_id')->nullable(false)->change();
        });
        Schema::table('mobility_dispatch_requests', function (Blueprint $table): void {
            $table->dropForeign(['pickup_point_id']);
            $table->unsignedBigInteger('pickup_point_id')->nullable(false)->change();
        });
        Schema::table('mobility_dispatch_availability', function (Blueprint $table): void {
            $table->foreign('pickup_point_id')->references('id')->on('mobility_pickup_points')->restrictOnDelete();
            $table->dropColumn('dispatch_scope');
        });
        Schema::table('mobility_dispatch_requests', function (Blueprint $table): void {
            $table->dropForeign(['target_driver_id']);
            $table->dropForeign(['private_journey_quote_id']);
            $table->dropIndex('mob_dispatch_private_target_idx');
            $table->dropColumn(['dispatch_scope', 'target_driver_id', 'private_journey_quote_id', 'private_source_hash']);
            $table->foreign('pickup_point_id')->references('id')->on('mobility_pickup_points')->restrictOnDelete();
        });
    }
};
