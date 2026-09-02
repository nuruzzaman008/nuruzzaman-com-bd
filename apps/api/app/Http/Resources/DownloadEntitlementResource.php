<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\DownloadEntitlement */
class DownloadEntitlementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $asset = $this->whenLoaded('asset') ? $this->asset : null;

        return [
            'id' => $this->id,
            'asset' => $asset ? [
                'slug' => $asset->slug,
                'name' => $asset->name,
                'version' => $asset->version,
                'size_bytes' => $asset->size_bytes,
                // Published so the customer can verify the file they received.
                'checksum_sha256' => $asset->checksum_sha256,
                'code_signing_status' => $asset->code_signing_status,
                'released_at' => $asset->released_at?->toIso8601String(),
                'is_available' => $asset->isServable(),
            ] : null,
            'order_number' => $this->whenLoaded('order', fn () => $this->order?->number),
            'download_count' => (int) $this->download_count,
            'max_downloads' => $this->max_downloads,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'revoked_at' => $this->revoked_at?->toIso8601String(),
            'is_usable' => ! $this->isRevoked() && ! $this->isExpired() && $this->hasRemainingDownloads(),
        ];
    }
}
