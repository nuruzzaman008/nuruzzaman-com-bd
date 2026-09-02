<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 180)->unique();
            $table->string('title', 255);
            $table->longText('body_markdown');
            $table->string('status', 24)->default('draft')->index();
            $table->string('template', 48)->default('default');
            // Legal pages stay flagged as a draft until an external professional
            // review is recorded (see docs/CONFIGURATION_CHECKLIST_BN.md).
            $table->boolean('requires_legal_review')->default(false);
            $table->boolean('legal_reviewed')->default(false);
            $table->string('legal_reviewer', 160)->nullable();
            $table->timestamp('legal_reviewed_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pages');
    }
};
