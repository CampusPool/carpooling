<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobility_trusted_share_grants', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('trip_id');
            $table->unsignedInteger('created_by');
            $table->string('scope', 16);
            $table->char('idempotency_key_hash', 64)->charset('ascii')->collation('ascii_bin');
            $table->char('request_fingerprint', 64)->charset('ascii')->collation('ascii_bin');
            // Digest supports lookup; ciphertext is only for encrypted retries.
            $table->char('token_hash', 64)->charset('ascii')->collation('ascii_bin');
            // Encrypted recovery for an exact idempotent retry; never plaintext.
            $table->text('token_ciphertext');
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->unique('token_hash', 'mobility_trusted_share_token_hash_unique');
            $table->unique(['trip_id', 'created_by', 'idempotency_key_hash'], 'mobility_trusted_share_idempotency_unique');
            $table->index(['trip_id', 'revoked_at', 'expires_at'], 'mobility_trusted_share_active_lookup');
            $table->foreign('trip_id')->references('id')->on('trips');
            $table->foreign('created_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobility_trusted_share_grants');
    }
};
