<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mobility_student_trusted_contacts', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('email', 254);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
        Schema::create('mobility_student_safety_checks', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('trip_id');
            $table->string('request_key', 100);
            $table->boolean('is_safe');
            $table->string('notification_status', 20);
            $table->timestamps();
            $table->unique(['user_id', 'request_key'], 'student_safety_request_unique');
            $table->index(['user_id', 'trip_id', 'id'], 'student_safety_history_idx');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobility_student_safety_checks');
        Schema::dropIfExists('mobility_student_trusted_contacts');
    }
};
