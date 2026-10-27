<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::create('mobility_commute_booking_notifications', function (Blueprint $t) {
   $t->id();
   $t->unsignedInteger('user_id');
   $t->unsignedInteger('booking_id');
   $t->unsignedInteger('trip_id');
   $t->string('kind', 32);
   $t->string('dedupe_key', 96);
   $t->timestamp('read_at')->nullable();
   $t->timestamps();
   $t->unique('dedupe_key');
   $t->index(['user_id', 'read_at', 'id']);
   $t->index(['booking_id', 'kind']);
  });
 }

 public function down(): void { Schema::dropIfExists('mobility_commute_booking_notifications'); }
};
