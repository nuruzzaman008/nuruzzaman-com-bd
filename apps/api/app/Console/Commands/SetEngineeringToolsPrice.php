<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Services\Content\RevalidationService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;

#[Signature('catalog:price-engineering-tools')]
#[Description('Publish the owner-approved NB Engineering Tools licences - 1 PC at BDT 4990 (regular 7900), 3-PC and 5-PC office packs at BDT 19900 and 29900 - preserving price history.')]
class SetEngineeringToolsPrice extends Command
{
    /**
     * The licences on sale, from the owner's price analysis.
     *
     * The single-PC launch price is shown against the regular price. The
     * 1,000 NB Credits that come with it are issued by an admin as a refill
     * after activation, so no credits are attached to the licence itself.
     * Each pack's device limit is what activation enforces.
     */
    private const LICENCES = [
        'NBET-V6-SINGLE' => ['name' => 'Single machine licence', 'devices' => 1, 'amount' => 4990, 'compare' => 7900, 'position' => 1],
        'NBET-V6-OFFICE-3' => ['name' => '3-PC office licence', 'devices' => 3, 'amount' => 19900, 'compare' => null, 'position' => 2],
        'NBET-V6-OFFICE-5' => ['name' => '5-PC office licence', 'devices' => 5, 'amount' => 29900, 'compare' => null, 'position' => 3],
    ];

    public function handle(): int
    {
        $product = Product::where('slug', 'nb-engineering-tools')->where('type', 'software_license')->first();

        if (! $product || ! $product->variants()->where('sku', 'NBET-V6-SINGLE')->exists()) {
            $this->error('Existing NBET-V6-SINGLE variant not found; no changes made.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($product) {
            Product::whereKey($product->id)->lockForUpdate()->firstOrFail();

            foreach (self::LICENCES as $sku => $licence) {
                $variant = $product->variants()->firstOrCreate(
                    ['sku' => $sku],
                    ['name' => $licence['name'], 'device_limit' => $licence['devices'], 'is_active' => true, 'position' => $licence['position']],
                );
                $variant->update(['device_limit' => $licence['devices'], 'is_active' => true]);

                $amount = $licence['amount'] * 100;
                $compare = $licence['compare'] === null ? null : $licence['compare'] * 100;
                $current = $variant->currentPrice();

                if ($current?->currency === 'BDT' && $current->amount_minor === $amount && $current->compare_at_minor === $compare) {
                    continue;
                }

                $variant->prices()->where('currency', 'BDT')->where('is_active', true)->update(['is_active' => false, 'ends_at' => now()]);
                $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => $amount, 'compare_at_minor' => $compare, 'is_active' => true, 'starts_at' => now()]);
            }

            $product->update(['is_price_public' => true]);
        });

        try {
            app(RevalidationService::class)->revalidate(['products', 'product:nb-engineering-tools']);
        } catch (ConnectionException $error) {
            report($error);
            $this->warn('Prices saved; frontend revalidation unavailable.');
        }

        $this->info('NB Engineering Tools: 1 PC BDT 4990 (regular 7900), 3-PC BDT 19900, 5-PC BDT 29900. Previous price rows preserved.');

        return self::SUCCESS;
    }
}
