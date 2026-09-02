<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 32)->nullable()->after('email');
            $table->string('locale', 8)->default('bn')->after('phone');
            $table->string('timezone', 64)->default('Asia/Dhaka')->after('locale');
            $table->string('status', 24)->default('active')->after('timezone')->index();
            $table->timestamp('last_login_at')->nullable()->after('status');
            $table->string('last_login_ip', 45)->nullable()->after('last_login_at');
            // MFA secret is encrypted at rest by the model cast; it is never exposed by an API resource.
            $table->text('mfa_secret')->nullable()->after('last_login_ip');
            $table->timestamp('mfa_confirmed_at')->nullable()->after('mfa_secret');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn([
                'phone', 'locale', 'timezone', 'status', 'last_login_at',
                'last_login_ip', 'mfa_secret', 'mfa_confirmed_at',
            ]);
        });
    }
};
