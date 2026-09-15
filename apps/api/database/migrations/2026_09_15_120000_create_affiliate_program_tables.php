<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The affiliate program: a customer's referral code, the visits it brings,
     * the commission each referred order earned, and the payouts the owner
     * sent outside the site (bKash, bank) and recorded here.
     *
     * Every timestamp the application sets is nullable: on MariaDB without
     * explicit_defaults_for_timestamp, the first NOT NULL timestamp column
     * silently gains ON UPDATE CURRENT_TIMESTAMP, which would move a
     * commission's release date every time the row changed.
     */
    public function up(): void
    {
        Schema::create('affiliates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('code', 32)->unique();
            $table->string('status', 20)->default('active')->index();
            // Null follows the program's default rate.
            $table->decimal('commission_rate', 5, 2)->nullable();
            $table->string('payout_method', 32)->nullable();
            $table->string('payout_account', 100)->nullable();
            $table->string('payout_name', 100)->nullable();
            $table->string('admin_note', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('affiliate_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('affiliate_id')->constrained()->cascadeOnDelete();
            $table->char('visitor_hash', 64);
            $table->string('landing_path', 255)->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->index(['affiliate_id', 'visitor_hash', 'created_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('affiliate_id')->nullable()->after('coupon_id')->constrained()->nullOnDelete();
        });

        Schema::create('affiliate_commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('affiliate_id')->constrained()->restrictOnDelete();
            $table->foreignId('order_id')->unique()->constrained()->restrictOnDelete();
            $table->string('currency', 3)->default('BDT');
            $table->unsignedBigInteger('base_minor');
            $table->decimal('rate', 5, 2);
            $table->unsignedBigInteger('amount_minor');
            $table->string('status', 20)->default('earned')->index();
            $table->timestamp('available_at')->nullable()->index();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('affiliate_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('affiliate_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount_minor');
            $table->string('currency', 3)->default('BDT');
            $table->string('method', 32);
            $table->string('reference', 100)->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // The permission row, so the admin role holds it without re-running
        // RoleSeeder on a live database. Super admins hold it implicitly.
        $now = now();
        DB::table('permissions')->updateOrInsert(
            ['name' => 'affiliates.manage'],
            [
                'group' => 'commerce',
                'description' => 'Run the affiliate program and record payouts',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );

        $permissionId = DB::table('permissions')->where('name', 'affiliates.manage')->value('id');
        $adminRoleId = DB::table('roles')->where('name', 'admin')->value('id');

        if ($permissionId && $adminRoleId) {
            DB::table('permission_role')->insertOrIgnore([
                'permission_id' => $permissionId,
                'role_id' => $adminRoleId,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('permissions')->where('name', 'affiliates.manage')->delete();

        Schema::dropIfExists('affiliate_payouts');
        Schema::dropIfExists('affiliate_commissions');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('affiliate_id');
        });

        Schema::dropIfExists('affiliate_visits');
        Schema::dropIfExists('affiliates');
    }
};
