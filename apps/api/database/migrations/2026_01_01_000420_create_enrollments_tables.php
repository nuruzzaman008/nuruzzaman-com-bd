<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('active')->index();
            $table->string('source', 24)->default('purchase');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason', 255)->nullable();
            $table->unsignedSmallInteger('progress_percent')->default(0);
            $table->foreignId('last_lesson_id')->nullable()->constrained('lessons')->nullOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'course_id']);
        });

        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            // Server-derived. The client never supplies a course completion figure;
            // it may only report the furthest position it has actually reached.
            $table->unsignedInteger('watched_seconds')->default(0);
            $table->boolean('is_completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->unique(['enrollment_id', 'lesson_id']);
        });

        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('verification_id', 40)->unique();
            $table->string('recipient_name', 160);
            $table->string('course_title', 255);
            $table->unsignedSmallInteger('score_percent')->nullable();
            $table->string('document_disk', 32)->nullable();
            $table->string('document_path', 512)->nullable();
            $table->timestamp('issued_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('course_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // A review row cannot exist without the enrolment that verifies it.
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->string('title', 200)->nullable();
            $table->text('body')->nullable();
            $table->string('status', 24)->default('in_review')->index();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['course_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_reviews');
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('lesson_progress');
        Schema::dropIfExists('enrollments');
    }
};
