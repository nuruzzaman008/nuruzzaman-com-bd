<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * English product copy, beside the Bengali original.
 *
 * The catalogue is small and a product's price, variants and licensing are the
 * same in either language, so a second row per product would duplicate all of
 * that for two paragraphs of prose. Two nullable columns keep one row per
 * product; when they are empty the English page falls back to the Bengali text
 * and says so, rather than machine translating it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('tagline_en', 255)->nullable()->after('tagline');
            $table->longText('description_markdown_en')->nullable()->after('description_markdown');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['tagline_en', 'description_markdown_en']);
        });
    }
};
