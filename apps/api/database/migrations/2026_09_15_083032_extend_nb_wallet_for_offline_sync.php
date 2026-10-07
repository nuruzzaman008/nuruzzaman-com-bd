<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! DB::connection()->pretending()) {
            // Validate every name before any DDL; never adopt or overwrite an unknown table.
            foreach (['nb_wallet_leases', 'nb_wallet_syncs'] as $table) {
                if (Schema::hasTable($table)) {
                    throw new LogicException("Wallet schema conflict: {$table} already exists. Inspect before retrying.");
                }
            }
            foreach (['nb_online_wallets' => ['software_license_id', 'balance'], 'nb_wallet_entries' => ['id', 'software_license_id', 'reference', 'delta', 'balance'], 'nb_devices' => ['id', 'software_license_id'], 'users' => ['id']] as $table => $columns) {
                if (! Schema::hasColumns($table, $columns)) {
                    throw new LogicException("Missing wallet prerequisite schema: {$table}.");
                }
            }
            foreach (['nb_online_wallets' => ['license_id', 'available_balance', 'reserved_balance', 'status', 'version'], 'nb_wallet_entries' => ['transaction_id', 'entry_type', 'amount', 'source', 'device_id', 'created_by', 'lease_id', 'device_sequence', 'request_hash', 'wallet_version']] as $table => $columns) {
                foreach ($columns as $column) {
                    if (Schema::hasColumn($table, $column)) {
                        throw new LogicException("Wallet column conflict: {$table}.{$column}.");
                    }
                }
            }

        }

        Schema::table('nb_online_wallets', function (Blueprint $table) {
            // Compatibility aliases: there is still only ONE writable settled balance.
            $table->unsignedBigInteger('license_id')->virtualAs('software_license_id');
            $table->unsignedBigInteger('reserved_balance')->default(0);
            $table->unsignedBigInteger('available_balance')->virtualAs('balance - reserved_balance');
            $table->enum('status', ['active', 'blocked', 'closed'])->default('active');
            $table->unsignedBigInteger('version')->default(0);
        });
        DB::statement('ALTER TABLE nb_online_wallets ADD CONSTRAINT nb_wallet_reserve_bound CHECK (reserved_balance <= balance)');

        Schema::create('nb_wallet_leases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('license_id')->constrained('nb_online_wallets', 'software_license_id')->restrictOnDelete();
            $table->foreignId('device_id')->constrained('nb_devices')->restrictOnDelete();
            $table->uuid('request_id');
            $table->char('request_hash', 64);
            $table->unsignedBigInteger('allowance');
            $table->unsignedBigInteger('consumed')->default(0);
            $table->unsignedBigInteger('released')->default(0);
            $table->unsignedBigInteger('last_sequence')->default(0);
            $table->unsignedInteger('policy_version');
            $table->json('policy_snapshot');
            $table->string('signing_key_id', 80);
            $table->enum('status', ['active', 'settled', 'revoked', 'review_required'])->default('active');
            $table->timestamp('issued_at');
            $table->timestamp('sync_due_at');
            $table->timestamp('expires_at');
            $table->timestamp('closed_at')->nullable();
            $table->unique(['device_id', 'request_id']);
            $table->index(['license_id', 'status']);
        });
        DB::statement('ALTER TABLE nb_wallet_leases ADD CONSTRAINT nb_lease_allowance_bound CHECK (consumed + released <= allowance)');
        DB::statement('ALTER TABLE nb_wallet_leases ADD CONSTRAINT nb_lease_time_bound CHECK (issued_at < sync_due_at AND sync_due_at <= expires_at)');

        Schema::table('nb_wallet_entries', function (Blueprint $table) {
            // Null only for legacy rows; Phase 2 must require IDs/source on every new entry.
            $table->uuid('transaction_id')->nullable()->unique();
            $table->string('entry_type', 6)->virtualAs("CASE WHEN delta < 0 THEN 'debit' ELSE 'credit' END");
            $table->unsignedBigInteger('amount')->virtualAs('ABS(delta)');
            $table->string('source', 40)->nullable();
            $table->foreignId('device_id')->nullable()->constrained('nb_devices')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->uuid('lease_id')->nullable();
            $table->foreign('lease_id')->references('id')->on('nb_wallet_leases')->restrictOnDelete();
            $table->unsignedBigInteger('device_sequence')->nullable();
            $table->char('request_hash', 64)->nullable();
            $table->unsignedBigInteger('wallet_version')->nullable();
            $table->unique(['lease_id', 'device_sequence']);
            $table->index(['software_license_id', 'created_at']);
        });
        Schema::create('nb_wallet_syncs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('license_id')->constrained('nb_online_wallets', 'software_license_id')->restrictOnDelete();
            $table->foreignId('device_id')->constrained('nb_devices')->restrictOnDelete();
            $table->uuid('lease_id');
            $table->foreign('lease_id')->references('id')->on('nb_wallet_leases')->restrictOnDelete();
            $table->uuid('request_id');
            $table->char('request_hash', 64);
            $table->unsignedBigInteger('expected_version');
            $table->unsignedBigInteger('result_version')->nullable();
            $table->unsignedBigInteger('first_sequence')->nullable();
            $table->unsignedBigInteger('last_sequence')->nullable();
            $table->unsignedInteger('accepted_count')->default(0);
            $table->enum('status', ['processing', 'accepted', 'rejected']);
            $table->string('error_code', 80)->nullable();
            $table->json('response')->nullable();
            $table->timestamp('created_at');
            $table->timestamp('completed_at')->nullable();
            $table->unique(['device_id', 'request_id']);
            $table->index(['license_id', 'created_at']);
        });
    }

    public function down(): void
    {
        throw new LogicException('Automatic wallet rollback is disabled to preserve ledger and offline reservations. Use a reviewed recovery plan.');
    }
};
