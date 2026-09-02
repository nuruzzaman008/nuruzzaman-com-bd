<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 180)->unique();
            $table->string('title', 255);
            $table->string('excerpt', 512)->nullable();
            // Markdown source. Rendering strips raw HTML (see MarkdownRenderer).
            $table->longText('body_markdown');
            $table->string('status', 24)->default('draft')->index();
            $table->foreignId('author_id')->nullable()->constrained('authors')->nullOnDelete();
            $table->foreignId('reviewed_by_author_id')->nullable()->constrained('authors')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->unsignedInteger('reading_minutes')->nullable();
            $table->string('funnel_stage', 24)->nullable();
            $table->string('search_intent', 32)->nullable();
            $table->timestamp('scheduled_for')->nullable()->index();
            $table->timestamp('published_at')->nullable()->index();
            $table->timestamp('content_updated_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'published_at']);
        });

        Schema::create('post_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('revision');
            $table->string('title', 255);
            $table->string('excerpt', 512)->nullable();
            $table->longText('body_markdown');
            $table->string('status', 24);
            $table->string('note', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['post_id', 'revision']);
        });

        Schema::create('category_post', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'category_id']);
        });

        Schema::create('post_tag', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_tag');
        Schema::dropIfExists('category_post');
        Schema::dropIfExists('post_revisions');
        Schema::dropIfExists('posts');
    }
};
