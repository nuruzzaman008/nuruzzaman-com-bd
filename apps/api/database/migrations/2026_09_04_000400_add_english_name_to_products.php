<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An English product name, beside the Bengali.
 *
 * Most product names do not need one - "NB Engineering Tools v6.0" reads the
 * same either way. A course sold as a product does: its name is the course
 * title, so a Bengali course headline was reaching the English shop and the
 * English home page through the catalogue rather than through the course list.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('name_en', 200)->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('name_en');
        });
    }
};
