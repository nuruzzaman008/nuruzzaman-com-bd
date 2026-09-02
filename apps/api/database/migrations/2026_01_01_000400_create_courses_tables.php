<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 180)->unique();
            $table->string('title', 255);
            $table->string('subtitle', 255)->nullable();
            $table->longText('description_markdown')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->string('level', 24)->default('beginner');
            $table->string('language', 32)->default('Bangla');
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->json('outcomes')->nullable();
            $table->json('audience')->nullable();
            $table->json('prerequisites')->nullable();
            $table->json('required_software')->nullable();
            $table->unsignedInteger('estimated_minutes')->nullable();
            $table->unsignedInteger('access_duration_days')->nullable();
            $table->boolean('sequential')->default(false);
            $table->unsignedSmallInteger('pass_percentage')->default(70);
            $table->boolean('issues_certificate')->default(false);
            $table->string('support_policy', 512)->nullable();
            $table->string('refund_policy', 512)->nullable();
            $table->timestamp('last_reviewed_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('course_instructors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('authors')->nullOnDelete();
            $table->string('role', 32)->default('instructor');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['course_id', 'user_id']);
        });

        Schema::create('course_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->string('summary', 512)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->unsignedInteger('drip_days')->nullable();
            $table->timestamps();
            $table->index(['course_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_sections');
        Schema::dropIfExists('course_instructors');
        Schema::dropIfExists('courses');
    }
};
