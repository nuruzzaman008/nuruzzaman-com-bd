<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 96)->index();
            $table->string('auditable_type', 96)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            // Payloads are written by App\Support\Audit which masks secrets and
            // truncates machine identifiers before they reach this table.
            $table->json('context')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('request_id', 64)->nullable()->index();
            $table->timestamp('created_at')->nullable()->index();
            $table->index(['auditable_type', 'auditable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
