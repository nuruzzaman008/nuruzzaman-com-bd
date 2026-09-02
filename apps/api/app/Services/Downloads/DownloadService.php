<?php

namespace App\Services\Downloads;

use App\Exceptions\DomainException;
use App\Models\DownloadAsset;
use App\Models\DownloadEntitlement;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Protected downloads.
 *
 * Files live on a private disk, never in Next.js /public and never in a public
 * bucket. Access is decided from the entitlement row, the asset path is never
 * taken from user input, and every attempt is recorded.
 */
class DownloadService
{
    /** @return array{url:string,expires_at:string}|array{stream:StreamedResponse} */
    public function issue(User $user, DownloadAsset $asset, Request $request): array
    {
        $entitlement = $this->authorize($user, $asset, $request);

        $disk = Storage::disk($asset->disk);

        if (! $disk->exists($asset->storage_path)) {
            $this->log($entitlement, 'missing_file', $request);

            throw DomainException::unavailable('This file is not available on the server yet.');
        }

        DB::transaction(function () use ($entitlement) {
            $entitlement->increment('download_count');
        });

        $this->log($entitlement, 'granted', $request);

        Audit::record('download.granted', $asset, [
            'entitlement_id' => $entitlement->getKey(),
            'download_count' => $entitlement->download_count + 1,
        ], $user->getKey());

        $ttl = now()->addMinutes((int) config('nb.downloads.signed_url_ttl_minutes'));

        // Object storage can hand out a short-lived signed URL. The local disk
        // cannot, so the file is streamed through the authenticated request.
        if (method_exists($disk, 'temporaryUrl') && $this->supportsTemporaryUrl($asset->disk)) {
            return [
                'url' => $disk->temporaryUrl($asset->storage_path, $ttl),
                'expires_at' => $ttl->toIso8601String(),
            ];
        }

        return ['stream' => $disk->download($asset->storage_path, $asset->original_filename ?: $asset->slug)];
    }

    public function authorize(User $user, DownloadAsset $asset, ?Request $request = null): DownloadEntitlement
    {
        if (! $asset->isServable()) {
            throw DomainException::unavailable('This download has not been published yet.');
        }

        /** @var DownloadEntitlement|null $entitlement */
        $entitlement = DownloadEntitlement::query()
            ->where('user_id', $user->getKey())
            ->where('download_asset_id', $asset->getKey())
            ->orderByDesc('id')
            ->first();

        if (! $entitlement) {
            throw DomainException::forbidden('You do not have a download entitlement for this file.');
        }

        if ($entitlement->isRevoked()) {
            $this->log($entitlement, 'revoked', $request);

            throw DomainException::forbidden('This entitlement has been revoked.');
        }

        if ($entitlement->isExpired()) {
            $this->log($entitlement, 'expired', $request);

            throw DomainException::forbidden('This entitlement has expired.');
        }

        if (! $entitlement->hasRemainingDownloads()) {
            $this->log($entitlement, 'limit_reached', $request);

            throw DomainException::forbidden('You have reached the download limit for this file.');
        }

        return $entitlement;
    }

    private function supportsTemporaryUrl(string $disk): bool
    {
        return config("filesystems.disks.$disk.driver") === 's3';
    }

    private function log(DownloadEntitlement $entitlement, string $outcome, ?Request $request): void
    {
        $entitlement->events()->create([
            'user_id' => $entitlement->user_id,
            'outcome' => $outcome,
            'ip_address' => $request?->ip(),
            'user_agent' => mb_substr((string) $request?->userAgent(), 0, 500),
            'request_id' => $request?->header('X-Request-Id'),
            'created_at' => now(),
        ]);
    }
}
