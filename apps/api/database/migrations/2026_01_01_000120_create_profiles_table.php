<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('display_name', 120)->nullable();
            $table->string('headline', 180)->nullable();
            $table->text('bio')->nullable();
            $table->string('organization', 160)->nullable();
            $table->string('designation', 160)->nullable();
            $table->string('district', 80)->nullable();
            $table->string('avatar_path', 255)->nullable();
            $table->json('links')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profiles');
    }
};
