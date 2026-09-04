<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Models\DownloadAsset;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Seeds the catalogue structure without inventing commercial facts.
 *
 * No price row is created: the owner publishes prices from the admin, and until
 * then every variant renders an honest "contact for price" state. The installer
 * asset is created as a not-yet-available placeholder; no file is copied from
 * the developer machine.
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $installer = DownloadAsset::query()->updateOrCreate(
            ['slug' => 'nb-engineering-tools-v6'],
            [
                'name' => 'NB Engineering Tools v6.0 Installer',
                'version' => '6.0',
                'disk' => config('nb.downloads.disk'),
                'storage_path' => null,
                'checksum_sha256' => config('nb.product.installer_sha256'),
                'code_signing_status' => config('nb.product.code_signing_status'),
                'test_status' => 'untested',
                'is_available' => false,
                'release_notes_markdown' => implode("\n", [
                    '## NB Engineering Tools v6.0',
                    '',
                    '- ২৫টি engineering/productivity + ১টি core/security = মোট ২৬টি compiled VLX module',
                    '- AutoCAD Ribbon এবং classic pull-down menu',
                    '- Machine activation, signed token refill, protected token wallet',
                    '- Vendor-verified license recovery',
                    '- Installer upgrade / repair / uninstall / rollback / log workflow',
                    '',
                    '> সামঞ্জস্য: '.config('nb.product.designed_for').', Windows 10/11 64-bit. ভিন্ন AutoCAD ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে।',
                ]),
            ],
        );

        $software = Product::query()->updateOrCreate(
            ['slug' => 'nb-engineering-tools'],
            [
                'type' => ProductType::SoftwareLicense,
                'name' => 'NB Engineering Tools v6.0',
                'tagline' => 'Structural & Engineering Design Tools for AutoCAD',
                'description_markdown' => $this->softwareDescription(),
                'description_markdown_en' => $this->softwareDescriptionEn(),
                'status' => ContentStatus::Published,
                'feature_groups' => [
                    'Layout, Grid & Schedule',
                    'Footing & Foundation',
                    'Geotechnical',
                    'Beam & Slab',
                    'Mouza & OCR',
                    'Dimension Utilities',
                    'License & System',
                ],
                'specs' => [
                    'platform' => 'Windows 10 / 11, 64-bit',
                    'autocad' => 'Designed for '.config('nb.product.designed_for'),
                    'applications' => '26 compiled VLX applications',
                    'menu' => 'Ribbon + classic pull-down menu',
                    'licensing' => 'Machine activation, signed token refill, protected token wallet',
                    'developer' => 'Engr. Md. Nuruzzaman, RSE',
                ],
                'is_price_public' => false,
                'published_at' => now(),
            ],
        );

        $license = $software->variants()->updateOrCreate(
            ['sku' => 'NBET-V6-SINGLE'],
            [
                'name' => 'Single machine licence',
                'description' => 'একটি machine-এ activation, vendor-verified recovery সহ।',
                'device_limit' => 1,
                'is_active' => true,
                'position' => 0,
            ],
        );

        $license->downloadAssets()->syncWithoutDetaching([
            $installer->getKey() => [
                'max_downloads' => config('nb.downloads.default_max_downloads'),
                'valid_days' => config('nb.downloads.default_valid_days'),
            ],
        ]);

        $credits = Product::query()->updateOrCreate(
            ['slug' => 'nb-credit-refill'],
            [
                'type' => ProductType::CreditRefill,
                'name' => 'NB Credit refill',
                'tagline' => 'NB Engineering Tools-এর token wallet রিফিল করুন।',
                'tagline_en' => 'Refill the NB Engineering Tools token wallet.',
                'description_markdown' => $this->refillDescription(),
                'description_markdown_en' => $this->refillDescriptionEn(),
                'status' => ContentStatus::Published,
                'is_price_public' => false,
                'published_at' => now(),
            ],
        );

        foreach ([500, 1000, 2500] as $index => $amount) {
            $credits->variants()->updateOrCreate(
                ['sku' => 'NBC-'.$amount],
                [
                    'name' => number_format($amount).' credits',
                    'credit_amount' => $amount,
                    'is_active' => true,
                    'position' => $index,
                ],
            );
        }
    }

    private function softwareDescription(): string
    {
        return implode("\n", [
            'NB Engineering Tools v6.0 হলো AutoCAD-এর জন্য তৈরি structural ও engineering design টুলসেট।',
            'এটি একটি productivity aid — চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব যোগ্য ব্যবহারকারীর।',
            '',
            '## কী আছে',
            '',
            '- ২৫টি engineering/productivity + ১টি core/security = মোট ২৬টি compiled VLX module, সাতটি feature group-এ সাজানো',
            '- AutoCAD Ribbon এবং classic pull-down menu — দুইভাবেই ব্যবহার করা যায়',
            '- Machine activation, signed token refill এবং protected token wallet',
            '- Vendor-verified license recovery',
            '- Installer-এ upgrade, repair, uninstall, rollback ও log workflow',
            '',
            '## সামঞ্জস্য',
            '',
            'মালিকের প্রকাশিত নথি অনুযায়ী বর্তমান commercial build '.config('nb.product.designed_for').', Windows 10/11 64-bit-এর জন্য প্রস্তুত।',
            'ভিন্ন AutoCAD ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে — রানটাইম-টেস্টের প্রমাণ ছাড়া কোনো ভার্সনকে পরীক্ষিত বলা হয় না।',
        ]);
    }

    /**
     * The English copy, translated from the Bengali above.
     *
     * The compatibility sentence is the one place where wording matters more
     * than fluency: it says designed for, not tested on, in both languages,
     * because that is the difference the owner's document draws.
     */
    private function softwareDescriptionEn(): string
    {
        return implode("\n", [
            'NB Engineering Tools v6.0 is a structural and engineering design toolset built for AutoCAD.',
            'It is a productivity aid — final checking and professional responsibility rest with the qualified user.',
            '',
            '## What it includes',
            '',
            '- 25 engineering/productivity modules plus 1 core/security module — 26 compiled VLX modules in all, arranged in seven feature groups',
            '- An AutoCAD Ribbon tab and the classic pull-down menu — either way of working',
            '- Machine activation, signed token refill and a protected token wallet',
            '- Vendor-verified licence recovery',
            '- Upgrade, repair, uninstall, rollback and log workflows in the installer',
            '',
            '## Compatibility',
            '',
            'According to the owner\'s published document, the current commercial build is prepared for '.config('nb.product.designed_for').', on Windows 10/11 64-bit.',
            'Compatibility with any other AutoCAD version has to be confirmed separately — no version is called tested without evidence of a runtime test.',
        ]);
    }

    private function refillDescription(): string
    {
        return implode("\n", [
            'NB Credit দিয়ে NB Engineering Tools-এর protected token wallet রিফিল করা হয়।',
            '',
            'অর্ডার করার পরে আপনার account থেকে Machine ID সহ একটি refill request জমা দিন।',
            'Vendor প্রক্রিয়া সম্পন্ন হলে account-এ নিরাপদ response পাবেন।',
            'কোনো key বা token এই ওয়েবসাইটে সংরক্ষণ করা হয় না।',
        ]);
    }

    private function refillDescriptionEn(): string
    {
        return implode("\n", [
            'NB Credit is what refills the protected token wallet in NB Engineering Tools.',
            '',
            'After ordering, submit a refill request from your account with your Machine ID.',
            'Once the vendor process is complete, a secure response appears in your account.',
            'No key and no token is ever stored on this website.',
        ]);
    }
}
