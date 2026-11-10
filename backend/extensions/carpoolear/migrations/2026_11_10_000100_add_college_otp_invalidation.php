<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('mobility_college_email_challenges', function (Blueprint $table): void {
            $table->timestamp('invalidated_at')->nullable()->after('consumed_at');
        });
    }

    public function down(): void
    {
        Schema::table('mobility_college_email_challenges', function (Blueprint $table): void {
            $table->dropColumn('invalidated_at');
        });
    }
};
