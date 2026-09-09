<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manual_payment_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_id')->unique()->constrained()->restrictOnDelete();
            $table->string('method', 32);
            $table->string('transaction_id', 100);
            $table->string('sender', 100);
            $table->text('recipient');
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('review_note', 500)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->unique(['method', 'transaction_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_payment_submissions');
    }
};
