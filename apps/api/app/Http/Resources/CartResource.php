<?php

namespace App\Http\Resources;

use App\Services\Commerce\CartTotals;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Cart */
class CartResource extends JsonResource
{
    public function __construct($resource, private readonly CartTotals $totals)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return array_merge(
            ['token' => $this->token, 'status' => $this->status],
            $this->totals->toArray(),
        );
    }
}
