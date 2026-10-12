<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_settings', function (Blueprint $t) {
            $t->unsignedInteger('id')->primary();
            foreach (['access_token', 'app_secret', 'verify_token'] as $field) {
                $t->text($field)->nullable();
            }
            $t->boolean('enabled')->default(false);
            $t->boolean('campaign_enabled')->default(false);
            $t->boolean('test_received')->default(false);
            $t->string('phone_number_id')->default('1312758371929461');
            $t->string('waba_id')->default('1569882861085596');
            $t->string('api_version')->default('v26.0');
            $t->unsignedTinyInteger('daily_limit')->default(50);
            $t->timestamp('webhook_at')->nullable();
            $t->timestamps();
        });
        DB::table('wa_settings')->insert(['id' => 1, 'created_at' => now(), 'updated_at' => now()]);
        Schema::create('wa_contacts', function (Blueprint $t) {
            $t->id();
            $t->string('phone', 20)->unique();
            $t->string('name')->nullable();
            $t->boolean('opt_in')->default(false);
            $t->string('consent_source')->nullable();
            $t->timestamp('consented_at')->nullable();
            $t->boolean('opt_out')->default(false);
            $t->boolean('suppressed')->default(false);
            $t->string('stage')->default('open');
            $t->string('tags')->nullable();
            $t->text('notes')->nullable();
            $t->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('last_inbound_at')->nullable();
            $t->timestamp('last_message_at')->nullable()->index();
            $t->unsignedInteger('unread')->default(0);
            $t->timestamps();
        });
        Schema::create('wa_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('contact_id')->constrained('wa_contacts');
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('wa_id')->nullable()->unique();
            $t->uuid('client_key')->nullable()->unique();
            $t->string('direction', 12);
            $t->string('kind', 20);
            $t->text('body')->nullable();
            $t->string('media_id')->nullable();
            $t->string('filename')->nullable();
            $t->string('mime')->nullable();
            $t->string('template')->nullable();
            $t->string('mode', 15)->default('reply');
            $t->string('status', 20)->default('queued');
            $t->string('error_code')->nullable();
            $t->string('error_details', 500)->nullable();
            $t->timestamp('occurred_at');
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
            $t->index(['mode', 'completed_at']);
            $t->index(['contact_id', 'id']);
        });
        Schema::create('wa_status_events', function (Blueprint $t) {
            $t->id();
            $t->string('fingerprint', 64)->unique();
            $t->string('wa_id')->index();
            $t->string('status', 20);
            $t->timestamp('occurred_at');
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_status_events');
        Schema::dropIfExists('wa_messages');
        Schema::dropIfExists('wa_contacts');
        Schema::dropIfExists('wa_settings');
    }
};
