<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 48)->unique();
            $table->string('description', 255)->nullable();
            $table->string('discount_type', 16);
            $table->unsignedInteger('discount_value');
            $table->unsignedBigInteger('minimum_subtotal_minor')->default(0);
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('max_redemptions_per_user')->default(1);
            $table->unsignedInteger('redemption_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->json('applies_to_variant_ids')->nullable();
            $table->timestamps();
        });

        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('discount_minor');
            $table->timestamps();
            $table->index(['coupon_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_redemptions');
        Schema::dropIfExists('coupons');
    }
};
