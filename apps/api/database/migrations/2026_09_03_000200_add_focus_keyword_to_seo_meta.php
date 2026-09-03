<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The phrase a page is written to rank for.
 *
 * Every check in the editor's SEO analysis is relative to this: whether it is
 * in the title, the description, the URL, the opening paragraph, a subheading,
 * an image's alt text. Without it the analysis can only measure length, which
 * tells an author nothing about whether the page is about what they meant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seo_meta', function (Blueprint $table) {
            $table->string('focus_keyword', 160)->nullable()->after('meta_description');
        });
    }

    public function down(): void
    {
        Schema::table('seo_meta', function (Blueprint $table) {
            $table->dropColumn('focus_keyword');
        });
    }
};
