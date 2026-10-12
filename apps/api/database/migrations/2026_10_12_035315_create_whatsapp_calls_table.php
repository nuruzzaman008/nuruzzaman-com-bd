<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_calls', function (Blueprint $t) {
            $t->id();
            $t->string('wa_id')->nullable()->unique();
            $t->uuid('client_key')->nullable()->unique();
            $t->string('phone', 20);
            $t->string('name')->nullable();
            $t->string('direction', 12);
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->uuid('session_key')->nullable();
            $t->string('status', 30);
            $t->text('remote_sdp')->nullable();
            $t->string('sdp_type', 10)->nullable();
            $t->unsignedInteger('duration')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->string('error', 500)->nullable();
            $t->timestamps();
            $t->index(['ended_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_calls');
    }
};
