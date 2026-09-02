<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 180)->unique();
            $table->string('type', 32)->index();
            $table->string('name', 200);
            $table->string('tagline', 255)->nullable();
            $table->longText('description_markdown')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->json('feature_groups')->nullable();
            $table->json('specs')->nullable();
            // A product without a published price renders an honest
            // "contact for price" state instead of a fabricated number.
            $table->boolean('is_price_public')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 64)->unique();
            $table->string('name', 200);
            $table->string('description', 512)->nullable();
            $table->unsignedInteger('credit_amount')->nullable();
            $table->unsignedInteger('license_term_days')->nullable();
            $table->unsignedSmallInteger('device_limit')->nullable();
            $table->unsignedInteger('access_duration_days')->nullable();
            $table->foreignId('course_id')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->string('currency', 3)->default('BDT');
            // Money is stored as an integer in minor units (1 BDT = 100 poisha).
            $table->unsignedBigInteger('amount_minor');
            $table->unsignedBigInteger('compare_at_minor')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['product_variant_id', 'is_active']);
        });

        Schema::create('bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignId('item_variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->unique(['bundle_variant_id', 'item_variant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bundle_items');
        Schema::dropIfExists('prices');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
    }
};
