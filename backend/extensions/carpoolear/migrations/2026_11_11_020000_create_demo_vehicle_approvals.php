<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobility_demo_vehicle_approvals', function (Blueprint $table): void {
            $table->unsignedInteger('car_id')->primary();
            $table->unsignedInteger('user_id');
            $table->string('registration', 10);
            $table->string('vehicle_fingerprint', 64);
            $table->timestamps();
            $table->unique(['user_id', 'registration']);
            $table->foreign('car_id')->references('id')->on('cars')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobility_demo_vehicle_approvals');
    }
};
