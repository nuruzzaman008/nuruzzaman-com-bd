<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * WordPress-style attachment details for the media library: a title and a
     * description of its own, whether its attachment page is left out of the
     * sitemap, a video's length, and what undoing an in-place image edit needs -
     * the untouched original's path and when the file last changed.
     */
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->string('title', 255)->nullable()->after('original_name');
            $table->string('original_path', 512)->nullable()->after('path');
            $table->unsignedInteger('duration_seconds')->nullable()->after('height');
            $table->text('description')->nullable()->after('caption');
            $table->boolean('exclude_from_sitemap')->default(false)->after('credit');
            $table->timestamp('edited_at')->nullable()->after('focal_y');
        });
    }

    public function down(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->dropColumn([
                'title', 'original_path', 'duration_seconds', 'description', 'exclude_from_sitemap', 'edited_at',
            ]);
        });
    }
};
