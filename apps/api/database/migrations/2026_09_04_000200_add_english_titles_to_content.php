<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * English titles and summaries, beside the Bengali ones.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT: a card on a listing page is navigation.
 * A reader on the English site scanning a grid of Bengali headlines cannot tell
 * one article from another, and that is a usability failure, not a translation
 * question. So titles, subtitles and excerpts get an English form.
 *
 * BODIES DO NOT. An article body carries load figures, bar spacings and code
 * clauses, and a body that says something slightly different in one language
 * than the other is a professional hazard rather than a cosmetic one. The body
 * stays in the language it was written in, under a visible notice saying so.
 *
 * One row per piece of content: the categories, the author, the review record
 * and the publication date are the same article in either language.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('title_en', 255)->nullable()->after('title');
            $table->text('excerpt_en')->nullable()->after('excerpt');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->string('title_en', 255)->nullable()->after('title');
            $table->string('subtitle_en', 255)->nullable()->after('subtitle');
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->string('title_en', 255)->nullable()->after('title');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['title_en', 'excerpt_en']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['title_en', 'subtitle_en']);
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn('title_en');
        });
    }
};
