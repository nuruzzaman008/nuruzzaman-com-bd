<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'brand.statement', 'group' => 'brand', 'is_public' => true, 'value' => 'প্রকৌশল শিখুন। কাজ দ্রুত করুন। আত্মবিশ্বাসের সঙ্গে ডিজাইন করুন।'],
            ['key' => 'brand.hero_support', 'group' => 'brand', 'is_public' => true, 'value' => 'Engr. Md. Nuruzzaman, RSE-এর practical engineering tutorials, verified technical articles এবং AutoCAD-এর জন্য NB Engineering Tools—এক জায়গায়।'],
            ['key' => 'product.feature_groups', 'group' => 'product', 'is_public' => true, 'value' => [
                'Layout, Grid & Schedule',
                'Footing & Foundation',
                'Geotechnical',
                'Beam & Slab',
                'Mouza & OCR',
                'Dimension Utilities',
                'License & System',
            ]],
            ['key' => 'product.system_requirements', 'group' => 'product', 'is_public' => true, 'value' => [
                'Windows 10 / 11, 64-bit',
                'AutoCAD 2024 (full desktop version) — অন্য ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে',
                'ইনস্টলেশনের জন্য administrator অধিকার',
                'Activation ও token refill-এর জন্য ইন্টারনেট সংযোগ',
            ]],
            // Deliberately not seeded: price, phone, address, support hours and
            // legal text. Those are owner-supplied and render an honest
            // "not available yet" state until they are configured.
        ];

        foreach ($settings as $setting) {
            Setting::query()->updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
