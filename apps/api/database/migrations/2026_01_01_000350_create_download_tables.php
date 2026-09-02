<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('download_assets', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('name', 200);
            $table->string('version', 40)->nullable();
            // Assets live on a private disk only. A row without a storage_path is
            // an honest "not yet available" state, never a public fallback file.
            $table->string('disk', 32)->default('private');
            $table->string('storage_path', 512)->nullable();
            $table->string('original_filename', 255)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('checksum_sha256', 64)->nullable();
            $table->string('code_signing_status', 32)->default('unknown');
            $table->string('test_status', 32)->default('untested');
            $table->text('release_notes_markdown')->nullable();
            $table->boolean('is_available')->default(false)->index();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
        });

        Schema::create('download_entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('download_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('max_downloads')->nullable();
            $table->unsignedInteger('download_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason', 255)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'download_asset_id', 'order_id'], 'download_entitlements_unique');
        });

        Schema::create('download_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('download_entitlement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('outcome', 24);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('request_id', 64)->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('download_events');
        Schema::dropIfExists('download_entitlements');
        Schema::dropIfExists('download_assets');
    }
};
