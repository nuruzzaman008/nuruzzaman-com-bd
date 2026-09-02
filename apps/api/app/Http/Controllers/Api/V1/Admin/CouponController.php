<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->guard($request);

        return response()->json([
            'data' => Coupon::query()->withCount('redemptions')->latest('id')->paginate(50),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate($this->rules(null));
        $validated['code'] = strtoupper($validated['code']);

        $coupon = Coupon::create($validated);
        Audit::record('coupon.created', $coupon, ['code' => $coupon->code]);

        return response()->json(['data' => $coupon], 201);
    }

    public function update(Request $request, Coupon $coupon): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate($this->rules($coupon->getKey()));

        if (isset($validated['code'])) {
            $validated['code'] = strtoupper($validated['code']);
        }

        $coupon->update($validated);

        return response()->json(['data' => $coupon->fresh()]);
    }

    public function destroy(Request $request, Coupon $coupon): JsonResponse
    {
        $this->guard($request);

        // Deactivated rather than deleted, so historical redemptions stay valid.
        $coupon->update(['is_active' => false]);

        return response()->json(['message' => 'Coupon deactivated.']);
    }

    private function rules(?int $couponId): array
    {
        return [
            'code' => [
                $couponId ? 'sometimes' : 'required', 'string', 'max:48', 'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('coupons', 'code')->ignore($couponId),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'discount_type' => [$couponId ? 'sometimes' : 'required', 'string', 'in:percent,fixed'],
            'discount_value' => [$couponId ? 'sometimes' : 'required', 'integer', 'min:1'],
            'minimum_subtotal_minor' => ['sometimes', 'integer', 'min:0'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            'max_redemptions_per_user' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
            'applies_to_variant_ids' => ['sometimes', 'nullable', 'array'],
            'applies_to_variant_ids.*' => ['integer', 'exists:product_variants,id'],
        ];
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('coupons.manage'), 403);
    }
}
