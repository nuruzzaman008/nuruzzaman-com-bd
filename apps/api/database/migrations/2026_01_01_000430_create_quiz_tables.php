<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('instructions')->nullable();
            $table->unsignedSmallInteger('pass_percentage')->default(70);
            $table->unsignedSmallInteger('max_attempts')->default(3);
            $table->unsignedInteger('time_limit_seconds')->nullable();
            $table->boolean('shuffle_questions')->default(true);
            $table->timestamps();
        });

        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->string('type', 24)->default('single_choice');
            $table->text('prompt');
            $table->text('explanation')->nullable();
            $table->unsignedSmallInteger('points')->default(1);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('quiz_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_question_id')->constrained()->cascadeOnDelete();
            $table->text('label');
            // Never serialised to a student before their attempt is graded.
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('attempt_number');
            $table->unsignedSmallInteger('score_percent')->nullable();
            $table->unsignedInteger('points_awarded')->default(0);
            $table->unsignedInteger('points_possible')->default(0);
            $table->boolean('passed')->default(false);
            $table->timestamp('started_at');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->unique(['quiz_id', 'enrollment_id', 'attempt_number']);
        });

        Schema::create('quiz_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quiz_question_id')->constrained()->cascadeOnDelete();
            $table->json('selected_option_ids')->nullable();
            $table->text('text_answer')->nullable();
            $table->boolean('is_correct')->default(false);
            $table->unsignedSmallInteger('points_awarded')->default(0);
            $table->timestamps();
            $table->unique(['quiz_attempt_id', 'quiz_question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_answers');
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_options');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};
