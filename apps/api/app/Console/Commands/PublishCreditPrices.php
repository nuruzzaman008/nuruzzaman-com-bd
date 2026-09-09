<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Services\Content\RevalidationService;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;

class PublishCreditPrices extends Command
{
    protected $signature = 'catalog:publish-credit-prices';

    protected $description = 'Publish the four owner-approved NB Credit packs while preserving price history.';

    public function handle(): int
    {
        $product = Product::where('slug', 'nb-credit-refill')->where('type', 'credit_refill')->first();
        if (! $product) {
            $this->error('NB credit refill product missing; no changes made.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($product) {
            Product::whereKey($product->id)->lockForUpdate()->firstOrFail();
            foreach ([500 => 499, 2000 => 1499, 5000 => 2999, 15000 => 6999] as $credits => $bdt) {
                $variant = $product->variants()->firstOrCreate(['sku' => 'NBC-'.$credits], ['name' => number_format($credits).' NB Credits', 'credit_amount' => $credits, 'is_active' => true, 'position' => $credits]);
                $variant->update(['credit_amount' => $credits, 'is_active' => true]);
                $current = $variant->currentPrice();
                if ($current?->currency === 'BDT' && $current->amount_minor === $bdt * 100 && $current->compare_at_minor === null) {
                    continue;
                }
                $variant->prices()->where('currency', 'BDT')->where('is_active', true)->update(['is_active' => false, 'ends_at' => now()]);
                $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => $bdt * 100, 'starts_at' => now(), 'is_active' => true]);
            }
            $product->update(['is_price_public' => true]);
        });
        try {
            app(RevalidationService::class)->revalidate(['products', 'product:nb-credit-refill']);
        } catch (ConnectionException $error) {
            report($error);
            $this->warn('Prices saved; frontend revalidation unavailable.');
        }
        $this->info('Published 500/2000/5000/15000 credits at BDT 499/1499/2999/6999.');

        return self::SUCCESS;
    }
}
