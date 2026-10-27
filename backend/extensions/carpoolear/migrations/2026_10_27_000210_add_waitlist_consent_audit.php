<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration { public function up(): void { Schema::table('mobility_commute_waitlist',function(Blueprint$t){$t->timestamp('consent_at')->nullable();$t->string('consent_quote_hash',64)->nullable();}); } public function down(): void { Schema::table('mobility_commute_waitlist',fn(Blueprint$t)=>$t->dropColumn(['consent_at','consent_quote_hash'])); } };
