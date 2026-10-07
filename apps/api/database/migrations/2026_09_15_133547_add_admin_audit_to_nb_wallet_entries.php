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
            if (! Schema::hasColumns('nb_wallet_entries', ['transaction_id', 'created_by', 'wallet_version']) || ! Schema::hasColumns('nb_online_wallets', ['reserved_balance', 'status', 'version'])) {
                throw new LogicException('Phase 1 wallet schema is required.');
            }
            foreach (['action_type', 'reason', 'reference_note', 'status_before', 'status_after', 'action_response'] as $column) {
                if (Schema::hasColumn('nb_wallet_entries', $column)) {
                    throw new LogicException('Wallet audit column already exists: '.$column);
                }
            }
        }
        Schema::table('nb_wallet_entries', function (Blueprint $table) {
            $table->string('action_type', 40)->nullable();
            $table->text('reason')->nullable();
            $table->string('reference_note', 500)->nullable();
            $table->string('status_before', 20)->nullable();
            $table->string('status_after', 20)->nullable();
            $table->json('action_response')->nullable();
        });
        DB::statement("ALTER TABLE nb_online_wallets MODIFY status ENUM('active','blocked','closed','suspended') NOT NULL DEFAULT 'active'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        throw new LogicException('Automatic rollback would remove wallet audit history. Use a reviewed forward migration.');
    }
};
