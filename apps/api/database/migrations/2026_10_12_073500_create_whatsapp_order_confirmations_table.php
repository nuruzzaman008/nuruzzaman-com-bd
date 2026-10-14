<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_messages', fn (Blueprint $t) => $t->json('template_params')->nullable());
        Schema::create('wa_order_confirmations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->unique()->constrained('orders')->cascadeOnDelete();
            $t->foreignId('message_id')->nullable()->constrained('wa_messages');
            $t->string('status')->default('pending');
            $t->string('reason')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_order_confirmations');
        Schema::table('wa_messages', fn (Blueprint $t) => $t->dropColumn('template_params'));
    }
};
