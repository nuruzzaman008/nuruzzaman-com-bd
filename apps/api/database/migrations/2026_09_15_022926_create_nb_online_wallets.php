<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nb_online_wallets', function (Blueprint $table) {
            $table->foreignId('software_license_id')->primary()->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('balance')->default(0);
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
        Schema::create('nb_wallet_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('software_license_id')->constrained()->restrictOnDelete();
            $table->string('reference', 180)->unique();
            $table->string('command', 80)->nullable();
            $table->unsignedInteger('units')->default(0);
            $table->bigInteger('delta');
            $table->unsignedBigInteger('balance');
            $table->foreignId('order_id')->nullable()->constrained()->restrictOnDelete();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nb_wallet_entries');
        Schema::dropIfExists('nb_online_wallets');
    }
};
