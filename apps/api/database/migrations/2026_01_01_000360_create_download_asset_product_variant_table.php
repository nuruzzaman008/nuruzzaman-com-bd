<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which protected assets a purchased variant entitles the buyer to download.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('download_asset_product_variant', function (Blueprint $table) {
            $table->foreignId('download_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('max_downloads')->nullable();
            $table->unsignedInteger('valid_days')->nullable();
            $table->primary(['download_asset_id', 'product_variant_id'], 'download_asset_variant_primary');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('download_asset_product_variant');
    }
};
