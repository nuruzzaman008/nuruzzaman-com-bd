<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The learning features that sit on top of the course/lesson/quiz core:
 * a browsable track, enforced prerequisites, course bundles, announcements,
 * a Q&A thread, private student notes and a wishlist.
 *
 * Everything a student writes here is owned by their enrolment, so revoking an
 * enrolment revokes the notes and questions with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            // Browsable subject track. Nullable so an uncategorised course is
            // still valid; the catalogue groups those under "all courses".
            $table->string('track', 64)->nullable()->after('level')->index();
        });

        Schema::create('course_prerequisites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('required_course_id')->constrained('courses')->cascadeOnDelete();
            // Advisory prerequisites are shown but do not block enrolment;
            // required ones are enforced by the enrolment service.
            $table->boolean('is_blocking')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['course_id', 'required_course_id']);
        });

        Schema::create('course_bundles', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 180)->unique();
            $table->string('title', 255);
            $table->string('subtitle', 255)->nullable();
            $table->longText('description_markdown')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('course_bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_bundle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['course_bundle_id', 'course_id']);
        });

        Schema::create('course_announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->longText('body_markdown');
            $table->timestamp('published_at')->nullable()->index();
            $table->timestamps();
            $table->index(['course_id', 'published_at']);
        });

        Schema::create('course_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('body');
            // Questions are held for moderation before they are visible to the
            // rest of the class, the same way course reviews are.
            $table->string('status', 24)->default('in_review')->index();
            $table->boolean('is_pinned')->default(false);
            $table->unsignedInteger('reply_count')->default(0);
            $table->timestamp('answered_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['course_id', 'status']);
        });

        Schema::create('course_question_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_question_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            // Set when the author is an instructor on the course at post time,
            // so the badge survives a later change to the teaching team.
            $table->boolean('from_instructor')->default(false);
            $table->string('status', 24)->default('published')->index();
            $table->timestamps();
        });

        Schema::create('lesson_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            // Where in the video the note was taken, when there is a video.
            $table->unsignedInteger('position_seconds')->nullable();
            $table->timestamps();
            $table->index(['enrollment_id', 'lesson_id']);
        });

        Schema::create('course_wishlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'course_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_wishlists');
        Schema::dropIfExists('lesson_notes');
        Schema::dropIfExists('course_question_replies');
        Schema::dropIfExists('course_questions');
        Schema::dropIfExists('course_announcements');
        Schema::dropIfExists('course_bundle_items');
        Schema::dropIfExists('course_bundles');
        Schema::dropIfExists('course_prerequisites');

        Schema::table('courses', function (Blueprint $table) {
            $table->dropIndex(['track']);
            $table->dropColumn('track');
        });
    }
};
