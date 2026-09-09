<?php

namespace App\Console\Commands;

use App\Models\ProductVariant;
use App\Services\Content\RevalidationService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;

#[Signature('catalog:price-engineering-tools')]
#[Description('Set the single-machine NB Engineering Tools offer to BDT 5599, compared with BDT 10599, preserving price history.')]
class SetEngineeringToolsPrice extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $variant = ProductVariant::where('sku', 'NBET-V6-SINGLE')
            ->whereHas('product', fn ($query) => $query->where('slug', 'nb-engineering-tools'))
            ->first();
        if (! $variant) {
            $this->error('Existing NBET-V6-SINGLE variant not found; no changes made.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($variant) {
            $variant = ProductVariant::whereKey($variant->id)->lockForUpdate()->firstOrFail();
            $current = $variant->currentPrice();
            $variant->product->update(['is_price_public' => true]);
            if ($current?->currency === 'BDT' && $current->amount_minor === 559900 && $current->compare_at_minor === 1059900) {
                return;
            }
            $variant->prices()->where('currency', 'BDT')->where('is_active', true)->update(['is_active' => false, 'ends_at' => now()]);
            $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => 559900, 'compare_at_minor' => 1059900, 'is_active' => true, 'starts_at' => now()]);
        });
        try {
            app(RevalidationService::class)->revalidate(['products', 'product:nb-engineering-tools']);
        } catch (ConnectionException $error) {
            report($error);
            $this->warn('Price saved; frontend revalidation unavailable.');
        }
        $this->info('NB Engineering Tools: BDT 5599; compare-at BDT 10599. Previous price rows preserved.');

        return self::SUCCESS;
    }
}
