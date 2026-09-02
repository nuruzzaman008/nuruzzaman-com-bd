<?php

namespace App\Services\Commerce;

use App\Exceptions\DomainException;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Carts live on the server. An anonymous cart is addressed by an opaque token
 * cookie; on sign-in it is merged into the customer's own cart.
 */
class CartService
{
    public function __construct(private readonly PricingService $pricing) {}

    public function forUser(User $user): Cart
    {
        return Cart::query()->firstOrCreate(
            ['user_id' => $user->getKey(), 'status' => 'open'],
            ['currency' => config('nb.site.currency')],
        );
    }

    public function forToken(?string $token): Cart
    {
        if ($token) {
            $cart = Cart::query()->where('token', $token)->where('status', 'open')->first();

            if ($cart) {
                return $cart;
            }
        }

        return Cart::create(['currency' => config('nb.site.currency')]);
    }

    public function addItem(Cart $cart, ProductVariant $variant, int $quantity = 1): Cart
    {
        if (! $variant->is_active) {
            throw new DomainException('This item is not available.');
        }

        if ($this->pricing->lineFor($variant, $quantity, $cart->currency)->unitPrice === null) {
            throw new DomainException('This item does not have a published price yet.');
        }

        DB::transaction(function () use ($cart, $variant, $quantity) {
            $item = $cart->items()->firstOrNew(['product_variant_id' => $variant->getKey()]);
            // Digital goods: one licence or seat per order line.
            $item->quantity = $this->isSingleSeat($variant)
                ? 1
                : min(99, ($item->exists ? $item->quantity : 0) + max(1, $quantity));
            $item->save();
        });

        return $cart->fresh(['items.variant.product', 'items.variant.prices', 'coupon']);
    }

    public function updateQuantity(Cart $cart, ProductVariant $variant, int $quantity): Cart
    {
        $item = $cart->items()->where('product_variant_id', $variant->getKey())->firstOrFail();

        if ($quantity <= 0) {
            $item->delete();
        } else {
            $item->update(['quantity' => $this->isSingleSeat($variant) ? 1 : min(99, $quantity)]);
        }

        return $cart->fresh(['items.variant.product', 'items.variant.prices', 'coupon']);
    }

    public function removeItem(Cart $cart, ProductVariant $variant): Cart
    {
        $cart->items()->where('product_variant_id', $variant->getKey())->delete();

        return $cart->fresh(['items.variant.product', 'items.variant.prices', 'coupon']);
    }

    public function applyCoupon(Cart $cart, string $code, ?User $user): Cart
    {
        $coupon = Coupon::query()->where('code', strtoupper(trim($code)))->first();

        if (! $coupon || ! $coupon->isWithinWindow()) {
            throw new DomainException('This coupon code is not valid.');
        }

        $cart->update(['coupon_id' => $coupon->getKey()]);
        $cart->refresh();

        $totals = $this->pricing->totalsFor($cart, $user);

        if ($totals->couponError) {
            $cart->update(['coupon_id' => null]);

            throw new DomainException($totals->couponError);
        }

        return $cart->fresh(['items.variant.product', 'items.variant.prices', 'coupon']);
    }

    public function removeCoupon(Cart $cart): Cart
    {
        $cart->update(['coupon_id' => null]);

        return $cart->fresh(['items.variant.product', 'items.variant.prices', 'coupon']);
    }

    /** Moves an anonymous cart into the signed-in customer's cart. */
    public function merge(Cart $guestCart, User $user): Cart
    {
        $target = $this->forUser($user);

        if ($guestCart->is($target)) {
            return $target;
        }

        DB::transaction(function () use ($guestCart, $target) {
            foreach ($guestCart->items()->with('variant')->get() as $item) {
                $existing = $target->items()->where('product_variant_id', $item->product_variant_id)->first();

                if ($existing) {
                    $existing->update([
                        'quantity' => $this->isSingleSeat($item->variant)
                            ? 1
                            : min(99, $existing->quantity + $item->quantity),
                    ]);

                    continue;
                }

                $target->items()->create([
                    'product_variant_id' => $item->product_variant_id,
                    'quantity' => $item->quantity,
                ]);
            }

            if ($guestCart->coupon_id && ! $target->coupon_id) {
                $target->update(['coupon_id' => $guestCart->coupon_id]);
            }

            $guestCart->update(['status' => 'merged']);
        });

        return $target->fresh(['items.variant.product', 'items.variant.prices', 'coupon']);
    }

    private function isSingleSeat(ProductVariant $variant): bool
    {
        $variant->loadMissing('product');

        return in_array($variant->product?->type?->value, ['course', 'software_license', 'bundle'], true);
    }
}
