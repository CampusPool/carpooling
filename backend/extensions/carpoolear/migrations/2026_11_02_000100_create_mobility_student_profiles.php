<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobility_student_profiles', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            // Callers store the trimmed, uppercase canonical SRN.
            $table->string('srn_normalized', 32)->unique();
            $table->string('campus_code', 64);
            $table->timestamps();

            $table->index('campus_code');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobility_student_profiles');
    }
};
