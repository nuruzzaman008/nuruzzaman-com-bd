<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('gateway', 32)->default('sslcommerz');
            // Our own reference sent to the gateway as tran_id.
            $table->string('reference', 64)->unique();
            $table->string('gateway_session_key', 128)->nullable();
            $table->string('gateway_transaction_id', 128)->nullable()->index();
            $table->string('bank_transaction_id', 128)->nullable();
            $table->string('card_type', 64)->nullable();
            $table->string('status', 24)->default('initiated')->index();
            $table->string('currency', 3)->default('BDT');
            $table->unsignedBigInteger('amount_minor');
            $table->unsignedBigInteger('settled_amount_minor')->nullable();
            $table->string('risk_level', 16)->nullable();
            $table->string('risk_title', 160)->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('source', 24);
            $table->string('event_type', 48);
            // Unique fingerprint of the callback so duplicate or replayed IPNs
            // are stored once and processed once.
            $table->string('fingerprint', 128)->unique();
            $table->json('payload');
            $table->string('remote_ip', 45)->nullable();
            $table->boolean('is_valid')->default(false);
            $table->string('validation_error', 255)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('number', 32)->unique();
            $table->string('currency', 3)->default('BDT');
            $table->unsignedBigInteger('total_minor');
            $table->json('snapshot');
            $table->string('document_disk', 32)->nullable();
            $table->string('document_path', 512)->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 24)->default('requested')->index();
            $table->unsignedBigInteger('amount_minor');
            $table->string('reason', 512)->nullable();
            $table->string('gateway_refund_id', 128)->nullable();
            $table->boolean('revoke_entitlements')->default(true);
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('payment_events');
        Schema::dropIfExists('payments');
    }
};
