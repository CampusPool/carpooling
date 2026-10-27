<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::create('mobility_commute_demo_receipts', function (Blueprint $t) {
   $t->id();
   $t->unsignedInteger('booking_id')->unique();
   $t->unsignedInteger('rider_id');
   $t->unsignedInteger('driver_id');
   $t->unsignedBigInteger('amount_minor');
   $t->string('currency', 3)->default('INR');
   $t->string('receipt_number', 40)->unique();
   $t->timestamp('confirmed_at');
   $t->timestamps();
  });
 }
 public function down(): void { Schema::dropIfExists('mobility_commute_demo_receipts'); }
};
