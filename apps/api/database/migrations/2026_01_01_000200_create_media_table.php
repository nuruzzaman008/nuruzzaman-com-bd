<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('disk', 32)->default('public');
            $table->string('path', 512);
            $table->string('original_name', 255);
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('checksum_sha256', 64)->nullable()->index();
            $table->string('alt_text', 255)->nullable();
            $table->string('caption', 512)->nullable();
            $table->string('credit', 160)->nullable();
            $table->decimal('focal_x', 5, 4)->default(0.5);
            $table->decimal('focal_y', 5, 4)->default(0.5);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
