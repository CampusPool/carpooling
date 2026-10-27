<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::create('mobility_trip_ratings', function (Blueprint $t): void {
   $t->id();
   $t->unsignedInteger('trip_id');
   $t->unsignedInteger('rater_id');
   $t->unsignedInteger('ratee_id');
   $t->unsignedTinyInteger('rating');
   $t->string('comment', 1000)->nullable();
   $t->string('idempotency_key', 100);
   $t->char('request_hash', 64);
   $t->timestamps();
   $t->unique(['trip_id', 'rater_id', 'ratee_id'], 'trip_rating_pair_unique');
   $t->unique(['trip_id', 'rater_id', 'idempotency_key'], 'trip_rating_idempotency_unique');
   $t->index(['ratee_id', 'created_at'], 'trip_rating_ratee_idx');
   $t->foreign('trip_id')->references('id')->on('trips')->restrictOnDelete();
   $t->foreign('rater_id')->references('id')->on('users')->restrictOnDelete();
   $t->foreign('ratee_id')->references('id')->on('users')->restrictOnDelete();
  });
  DB::statement('ALTER TABLE mobility_trip_ratings ADD CONSTRAINT trip_rating_rating_range CHECK (rating BETWEEN 1 AND 5)');
  DB::statement('ALTER TABLE mobility_trip_ratings ADD CONSTRAINT trip_rating_distinct_users CHECK (rater_id <> ratee_id)');
 }
 public function down(): void { Schema::dropIfExists('mobility_trip_ratings'); }
};
