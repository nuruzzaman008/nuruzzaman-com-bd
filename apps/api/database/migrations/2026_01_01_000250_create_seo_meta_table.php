<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seo_meta', function (Blueprint $table) {
            $table->id();
            $table->string('seoable_type', 96);
            $table->unsignedBigInteger('seoable_id');
            $table->string('meta_title', 255)->nullable();
            $table->string('meta_description', 320)->nullable();
            $table->string('canonical_url', 512)->nullable();
            $table->foreignId('og_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->boolean('noindex')->default(false);
            $table->boolean('nofollow')->default(false);
            $table->json('extra')->nullable();
            $table->timestamps();
            $table->unique(['seoable_type', 'seoable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seo_meta');
    }
};
