<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Foreign keys that could not be declared inline because the referenced table is
 * created by a later migration (variants reference courses, carts reference
 * coupons, coupon redemptions reference orders).
 *
 * SQLite cannot add a constraint to an existing table, and the test suite runs
 * on an in-memory SQLite database, so the constraints are applied only on
 * drivers that support ALTER TABLE ... ADD CONSTRAINT. The application enforces
 * the same relationships through Eloquent regardless of driver.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! $this->supportsAlterConstraints()) {
            return;
        }

        Schema::table('product_variants', function (Blueprint $table) {
            $table->foreign('course_id')->references('id')->on('courses')->nullOnDelete();
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->foreign('coupon_id')->references('id')->on('coupons')->nullOnDelete();
        });

        Schema::table('coupon_redemptions', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! $this->supportsAlterConstraints()) {
            return;
        }

        Schema::table('coupon_redemptions', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropForeign(['coupon_id']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
        });
    }

    private function supportsAlterConstraints(): bool
    {
        return ! in_array(Schema::getConnection()->getDriverName(), ['sqlite', 'sqlsrv'], true);
    }
};
