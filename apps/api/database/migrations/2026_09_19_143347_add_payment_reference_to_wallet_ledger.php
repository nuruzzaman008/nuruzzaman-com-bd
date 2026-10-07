<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! DB::connection()->pretending()) {
            if (! Schema::hasColumns('nb_wallet_entries', ['action_type', 'reason', 'created_by', 'transaction_id'])) {
                throw new LogicException('Phase 3 wallet ledger is required.');
            }
            if (Schema::hasColumn('payments', 'wallet_credit_result') || Schema::hasColumn('nb_wallet_entries', 'payment_id') || Schema::hasColumn('nb_wallet_entries', 'user_id')) {
                throw new LogicException('Payment wallet audit columns already exist. Inspect before retrying.');
            }
        }
        Schema::table('nb_wallet_entries', function (Blueprint $table) {
            $table->foreignId('payment_id')->nullable()->unique()->constrained('payments')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->restrictOnDelete();
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->json('wallet_credit_result')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        throw new LogicException('Payment audit history must not be removed automatically; use a reviewed forward migration.');
    }
};
