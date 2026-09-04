<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * English search metadata, beside the Bengali.
 *
 * An SEO override always beats the content's own title, which is the point of
 * it - an editor can correct a headline that reads badly in search results.
 * Without an English pair, that override also silently put the Bengali headline
 * in the browser tab and in Google's result for every English page, however
 * carefully the page itself had been translated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seo_meta', function (Blueprint $table) {
            $table->string('meta_title_en', 255)->nullable()->after('meta_title');
            $table->string('meta_description_en', 320)->nullable()->after('meta_description');
        });
    }

    public function down(): void
    {
        Schema::table('seo_meta', function (Blueprint $table) {
            $table->dropColumn(['meta_title_en', 'meta_description_en']);
        });
    }
};
