<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('growth_goals', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('parent_id')->nullable()->constrained('growth_goals')->nullOnDelete();
            $t->string('title');
            $t->text('description')->nullable();
            $t->string('category', 80)->default('Other');
            $t->string('horizon', 30)->default('annual');
            $t->text('why')->nullable();
            $t->text('notes')->nullable();
            $t->date('start_date')->nullable();
            $t->date('target_date')->nullable();
            $t->string('status', 30)->default('pending');
            $t->string('priority', 20)->default('medium');
            $t->unsignedTinyInteger('progress')->default(0);
            $t->timestamps();
            $t->index(['user_id', 'status']);
        });
        Schema::create('growth_tasks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('goal_id')->nullable()->constrained('growth_goals')->nullOnDelete();
            $t->string('title');
            $t->text('description')->nullable();
            $t->string('category', 80)->default('Other');
            $t->string('source', 100)->default('manual');
            $t->string('priority', 20)->default('medium');
            $t->string('status', 30)->default('pending');
            $t->dateTime('due_at')->nullable();
            $t->date('focus_date')->nullable();
            $t->unsignedTinyInteger('focus_rank')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'due_at']);
            $t->unique(['user_id', 'focus_date', 'focus_rank']);
        });
        Schema::create('growth_ideas', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->text('description')->nullable();
            $t->string('category', 80)->default('Other');
            $t->string('status', 30)->default('pending');
            $t->timestamps();
            $t->index(['user_id', 'created_at']);
        });
        Schema::create('growth_daily_reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->date('review_date');
            foreach (['completed', 'learned', 'pending', 'tomorrow', 'lesson'] as $field) {
                $t->text($field)->nullable();
            }
            $t->timestamps();
            $t->unique(['user_id', 'review_date']);
        });
        Schema::create('growth_preferences', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('display_name')->nullable();
            $t->string('profession')->nullable();
            $t->string('timezone', 60)->default('Asia/Dhaka');
            $t->json('cards')->nullable();
            $t->text('interests')->nullable();
            $t->timestamps();
        });
        Schema::create('growth_ai_providers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('provider', 40);
            $t->string('display_name', 100);
            $t->text('secret')->nullable();
            $t->string('base_url')->nullable();
            $t->string('model', 100);
            $t->boolean('enabled')->default(false);
            $t->boolean('is_default')->default(false);
            $t->unsignedSmallInteger('priority')->default(10);
            $t->string('purpose', 40)->default('general');
            $t->decimal('monthly_budget', 10, 2)->nullable();
            $t->decimal('input_rate', 12, 6)->nullable();
            $t->decimal('output_rate', 12, 6)->nullable();
            $t->string('connection_status', 30)->default('not_configured');
            $t->timestamp('checked_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'enabled']);
        });
        Schema::create('growth_conversations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->boolean('archived')->default(false);
            $t->timestamps();
            $t->index(['user_id', 'updated_at']);
        });
        Schema::create('growth_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('conversation_id')->constrained('growth_conversations')->cascadeOnDelete();
            $t->string('role', 20);
            $t->text('content');
            $t->json('context')->nullable();
            $t->string('provider')->nullable();
            $t->string('model')->nullable();
            $t->timestamps();
        });
        Schema::create('growth_ai_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('provider_id')->nullable()->constrained('growth_ai_providers')->nullOnDelete();
            $t->string('provider');
            $t->string('model');
            $t->string('feature', 40);
            $t->string('status', 30);
            $t->unsignedInteger('duration_ms')->default(0);
            $t->unsignedInteger('input_tokens')->nullable();
            $t->unsignedInteger('output_tokens')->nullable();
            $t->decimal('estimated_cost', 12, 6)->nullable();
            $t->string('error_code', 60)->nullable();
            $t->timestamps();
            $t->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['growth_ai_logs', 'growth_messages', 'growth_conversations', 'growth_ai_providers', 'growth_preferences', 'growth_daily_reviews', 'growth_ideas', 'growth_tasks', 'growth_goals'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
