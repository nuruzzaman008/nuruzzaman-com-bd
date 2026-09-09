<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nb_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('software_license_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('secret_hash', 64)->unique();
            $table->string('pair_hash', 64)->unique();
            $table->text('machine_encrypted');
            $table->string('machine_hash', 64)->index();
            $table->timestamp('expires_at');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('nb_token_issues', function (Blueprint $table) {
            $table->id();
            $table->string('entitlement', 150)->unique();
            $table->foreignId('software_license_id')->constrained()->restrictOnDelete();
            $table->foreignId('nb_device_id')->constrained('nb_devices')->restrictOnDelete();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->text('payload_encrypted');
            $table->text('token_encrypted')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nb_token_issues');
        Schema::dropIfExists('nb_devices');
    }
};
