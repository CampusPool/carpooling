<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mobility_driver_onboardings', function (Blueprint $table): void {
            $table->unsignedInteger('legal_passenger_capacity')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('mobility_driver_onboardings', function (Blueprint $table): void {
            $table->dropColumn('legal_passenger_capacity');
        });
    }
};
