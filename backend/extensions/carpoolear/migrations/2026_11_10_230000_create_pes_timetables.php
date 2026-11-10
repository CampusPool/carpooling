<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void {Schema::create('mobility_pes_timetables',function(Blueprint $t):void {$t->unsignedInteger('user_id')->primary();$t->json('entries');$t->timestamps();});}
 public function down(): void {Schema::dropIfExists('mobility_pes_timetables');}
};
