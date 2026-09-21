<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * The two things two-step verification was still missing, next to the
 * mfa_secret and mfa_confirmed_at columns it already has:
 * - mfa_recovery_codes: SHA-256 hashes of the one-time recovery codes, as a
 *   JSON list. The codes themselves are shown once and never stored.
 * - mfa_last_used_step: the time step of the last app code accepted, so the
 *   same code cannot be used twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('mfa_recovery_codes')->nullable()->after('mfa_confirmed_at');
            $table->unsignedBigInteger('mfa_last_used_step')->nullable()->after('mfa_recovery_codes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mfa_recovery_codes', 'mfa_last_used_step']);
        });
    }
};
