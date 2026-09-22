<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Replies to contact form messages, sent by email from the dashboard's
| message inbox. The sender has no account, so the reply goes to the address
| they gave; it is kept here so the conversation can be read back.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_message_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['contact_message_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_message_replies');
    }
};
