<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('authors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug', 120)->unique();
            $table->string('name', 160);
            $table->string('credentials', 120)->nullable();
            $table->string('headline', 200)->nullable();
            $table->text('bio')->nullable();
            $table->foreignId('photo_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->json('same_as')->nullable();
            $table->boolean('is_reviewer')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('authors');
    }
};
