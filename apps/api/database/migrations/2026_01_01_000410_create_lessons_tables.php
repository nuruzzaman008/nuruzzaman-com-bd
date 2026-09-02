<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_section_id')->constrained()->cascadeOnDelete();
            $table->string('slug', 180);
            $table->string('title', 255);
            $table->string('type', 24)->default('text');
            $table->longText('body_markdown')->nullable();
            // Provider + provider-side id only. A private playback URL or token is
            // never stored or exposed; it is minted per request by the video driver.
            $table->string('video_provider', 32)->nullable();
            $table->string('video_asset_id', 128)->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->boolean('is_free_preview')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->unsignedInteger('drip_days')->nullable();
            $table->timestamps();
            $table->unique(['course_id', 'slug']);
            $table->index(['course_section_id', 'position']);
        });

        Schema::create('lesson_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200);
            $table->string('disk', 32)->default('private');
            $table->string('storage_path', 512);
            $table->string('mime_type', 128)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('checksum_sha256', 64)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_assets');
        Schema::dropIfExists('lessons');
    }
};
