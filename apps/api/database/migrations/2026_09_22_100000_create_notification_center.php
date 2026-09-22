<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| The notification center.
|
| `notifications` is Laravel's own database-notification table, so the
| Notifiable trait on User reads it as usual; `type` holds the event key
| (order.paid, ticket.opened ...) rather than a class name, which keeps it
| short and lets the dashboard filter on it.
|
| `notification_preferences` holds only choices someone actually made; a
| missing row means the default for their role.
|
| `notification_emails` is the email log: one row per email the site sent or
| tried to send, with how it went. Notification emails are sent from it, and
| every other email the site sends is recorded in it too.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 64);
            $table->morphs('notifiable');
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id', 'read_at']);
            $table->index(['notifiable_type', 'notifiable_id', 'created_at']);
        });

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('category', 32);
            $table->boolean('email');
            $table->timestamps();

            $table->unique(['user_id', 'category']);
        });

        Schema::create('notification_emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('notification_id')->nullable()->index();
            // 'notification' rows are sent from here; 'mail' rows record the
            // site's other emails (receipts, answers, password resets).
            $table->string('source', 16)->default('notification');
            $table->string('type', 128);
            $table->string('recipient', 255);
            $table->string('subject', 255)->nullable();
            $table->string('locale', 8)->default('bn');
            $table->json('payload')->nullable();
            $table->string('status', 16)->default('pending');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_emails');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notifications');
    }
};
