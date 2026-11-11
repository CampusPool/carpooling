<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('mobility_student_profiles', function (Blueprint $table): void {
            $table->string('gender_identity', 24)->nullable();
            $table->string('phone_e164', 16)->nullable();
        });
        Schema::create('mobility_student_browser_sessions', function (Blueprint $table): void {
            $table->string('token_hash', 64)->primary();
            $table->unsignedInteger('user_id');
            $table->timestamp('expires_at')->index();
            $table->foreign('user_id')->references('id')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobility_student_browser_sessions');
        Schema::table('mobility_student_profiles', function (Blueprint $table): void {
            $table->dropColumn(['gender_identity', 'phone_e164']);
        });
    }
};
