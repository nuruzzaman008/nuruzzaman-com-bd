<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reader comments on an article, each optionally carrying a star rating.
 *
 * ONE TABLE, NOT TWO. A rating without a comment says a reader liked something
 * and nothing about why; a comment is the useful artefact and the rating is a
 * field on it. It also means one moderation queue rather than two.
 *
 * SIGNED IN ONLY. `user_id` is not nullable: an anonymous comment box on an
 * engineering site is a spam magnet, and a name typed into a box is not an
 * identity. The display name is copied at the time of writing so that a later
 * profile edit does not silently rewrite what appears under an old comment.
 *
 * NOTHING IS PUBLIC UNTIL IT IS APPROVED. The default status is `pending`, and
 * only `approved` rows are ever served, counted, or fed into structured data.
 * That is what keeps a spam link out of the page and out of Google's index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // The name as it was when the comment was written.
            $table->string('author_name', 160);
            $table->text('body');

            /*
             * 1-5, or null for a comment with no rating attached. A reader may
             * want to ask a question without scoring the article, and forcing a
             * star out of them would make every average meaningless.
             */
            $table->unsignedTinyInteger('rating')->nullable();

            $table->string('status', 24)->default('pending')->index();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();

            // Kept for abuse handling only, never exposed by the API.
            $table->string('ip_hash', 64)->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['post_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_comments');
    }
};
