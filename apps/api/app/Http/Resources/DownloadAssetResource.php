<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\DownloadAsset */
class DownloadAssetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'version' => $this->version,
            'size_bytes' => $this->size_bytes,
            'checksum_sha256' => $this->checksum_sha256,
            'code_signing_status' => $this->code_signing_status,
            'test_status' => $this->test_status,
            'release_notes_html' => Markdown::toHtml($this->release_notes_markdown),
            'released_at' => $this->released_at?->toIso8601String(),
            'is_available' => $this->isServable(),
        ];
    }
}
