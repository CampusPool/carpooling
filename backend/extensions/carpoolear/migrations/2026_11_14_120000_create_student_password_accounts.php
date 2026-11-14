<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mobility_student_password_accounts', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('username', 32)->unique();
            $table->string('password_hash');
            $table->unsignedInteger('credential_version')->default(1);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
    public function down(): void { Schema::dropIfExists('mobility_student_password_accounts'); }
};
