<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('account_mode', 16)->default('ecommerce');
        });
        Schema::table('lessons', function (Blueprint $table) {
            $table->string('video_url', 2048)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lessons', fn (Blueprint $table) => $table->dropColumn('video_url'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('account_mode'));
    }
};
