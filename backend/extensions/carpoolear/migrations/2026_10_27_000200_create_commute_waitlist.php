<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::create('mobility_commute_waitlist', function (Blueprint $t) {
   $t->increments('id');
   $t->unsignedInteger('trip_id')->index();
   $t->unsignedInteger('rider_id')->index();
   $t->string('match_key', 64);
   $t->string('status', 16)->default('pending')->index();
   $t->timestamps();
   // Active uniqueness is enforced while holding the trip row lock; a rider may
   // cancel and later rejoin, so cancelled history must not collide.
   $t->index(['trip_id','rider_id','status']);
  });
 }
 public function down(): void { Schema::dropIfExists('mobility_commute_waitlist'); }
};
