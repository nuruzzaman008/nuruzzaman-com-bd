<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('number', 32)->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status', 24)->default('draft')->index();
            $table->string('currency', 3)->default('BDT');
            $table->unsignedBigInteger('subtotal_minor')->default(0);
            $table->unsignedBigInteger('discount_minor')->default(0);
            $table->unsignedBigInteger('tax_minor')->default(0);
            $table->unsignedBigInteger('total_minor')->default(0);
            $table->unsignedBigInteger('refunded_minor')->default(0);
            $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
            $table->string('billing_name', 160)->nullable();
            $table->string('billing_email', 191)->nullable();
            $table->string('billing_phone', 32)->nullable();
            // Snapshot of the exact policy text the customer accepted at checkout.
            $table->json('accepted_terms')->nullable();
            $table->timestamp('terms_accepted_at')->nullable();
            $table->string('placed_ip', 45)->nullable();
            $table->timestamp('placed_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('fulfilled_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            // Immutable snapshot: the purchased name/price survives catalogue edits.
            $table->string('product_type', 32);
            $table->string('product_name', 200);
            $table->string('variant_name', 200);
            $table->string('sku', 64);
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->unsignedBigInteger('unit_price_minor');
            $table->unsignedBigInteger('discount_minor')->default(0);
            $table->unsignedBigInteger('tax_minor')->default(0);
            $table->unsignedBigInteger('line_total_minor');
            $table->json('fulfillment_meta')->nullable();
            $table->timestamps();
        });

        Schema::create('order_status_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->string('reason', 255)->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_events');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
