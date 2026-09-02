<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use Illuminate\Http\JsonResponse;

/**
 * Public certificate check. It confirms or denies a verification id and shows
 * nothing else about the holder beyond the name printed on the certificate.
 */
class CertificateVerificationController extends Controller
{
    public function __invoke(string $verificationId): JsonResponse
    {
        $certificate = Certificate::query()
            ->where('verification_id', $verificationId)
            ->with('course')
            ->first();

        if (! $certificate) {
            return response()->json(['data' => ['valid' => false, 'reason' => 'not_found']], 404);
        }

        return response()->json([
            'data' => [
                'valid' => $certificate->isValid(),
                'reason' => $certificate->isValid() ? null : 'revoked',
                'verification_id' => $certificate->verification_id,
                'recipient_name' => $certificate->recipient_name,
                'course_title' => $certificate->course_title,
                'course_slug' => $certificate->course?->slug,
                'issued_at' => $certificate->issued_at?->toIso8601String(),
            ],
        ]);
    }
}
