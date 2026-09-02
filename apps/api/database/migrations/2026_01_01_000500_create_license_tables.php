<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('software_licenses', function (Blueprint $table) {
            $table->id();
            $table->string('license_code', 64)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name', 200);
            $table->string('status', 24)->default('issued')->index();
            $table->unsignedSmallInteger('device_limit')->default(1);
            $table->timestamp('issued_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('machine_bindings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('software_license_id')->constrained()->cascadeOnDelete();
            // The full machine identifier is encrypted at rest by the model cast.
            // Only the masked fingerprint below is ever rendered or logged.
            $table->text('machine_id_encrypted');
            $table->string('machine_id_fingerprint', 64)->index();
            $table->string('machine_id_masked', 40);
            $table->string('label', 120)->nullable();
            $table->timestamp('bound_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->unique(['software_license_id', 'machine_id_fingerprint'], 'machine_bindings_unique');
        });

        Schema::create('activation_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 32)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('software_license_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('submitted')->index();
            $table->string('request_type', 24)->default('activation');
            $table->text('machine_id_encrypted');
            $table->string('machine_id_fingerprint', 64)->index();
            $table->string('machine_id_masked', 40);
            $table->string('autocad_version', 32)->nullable();
            $table->string('windows_version', 64)->nullable();
            $table->text('customer_note')->nullable();
            // Safe, human-written response. Never a token, key or recovery blob.
            $table->text('vendor_response')->nullable();
            $table->text('internal_note')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('activation_request_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activation_request_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->string('note', 512)->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('refill_orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 32)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('software_license_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('credit_amount');
            $table->string('status', 24)->default('requested')->index();
            $table->text('vendor_response')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refill_orders');
        Schema::dropIfExists('activation_request_events');
        Schema::dropIfExists('activation_requests');
        Schema::dropIfExists('machine_bindings');
        Schema::dropIfExists('software_licenses');
    }
};
