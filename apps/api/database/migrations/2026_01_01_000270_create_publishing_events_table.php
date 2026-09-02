<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publishing_events', function (Blueprint $table) {
            $table->id();
            $table->string('publishable_type', 96);
            $table->unsignedBigInteger('publishable_id');
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note', 255)->nullable();
            // Set once the signed Next.js revalidation endpoint has acknowledged.
            $table->timestamp('revalidated_at')->nullable();
            $table->timestamps();
            $table->index(['publishable_type', 'publishable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publishing_events');
    }
};
