<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::table('mobility_commute_profiles', function (Blueprint $t): void {
   $t->string('gender_identity', 32)->nullable()->after('preferences');
   $t->boolean('same_gender_only')->default(false)->after('gender_identity');
   $t->index(['same_gender_only', 'gender_identity'], 'commute_gender_match_idx');
  });
 }
 public function down(): void {
  Schema::table('mobility_commute_profiles', function (Blueprint $t): void {
   $t->dropIndex('commute_gender_match_idx');
   $t->dropColumn(['same_gender_only', 'gender_identity']);
  });
 }
};
