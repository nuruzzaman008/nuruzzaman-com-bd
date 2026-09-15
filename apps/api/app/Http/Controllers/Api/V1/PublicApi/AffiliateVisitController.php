<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Services\Affiliates\AffiliateProgram;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AffiliateVisitController extends Controller
{
    /**
     * A visitor arrived through a referral link. Tells the site whether the
     * code is live and how long to remember it; the code itself is kept in
     * the visitor's browser and sent with their checkout.
     */
    public function __invoke(Request $request, AffiliateProgram $program): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'path' => ['nullable', 'string', 'max:2000'],
        ]);

        $affiliate = $program->activeByCode($validated['code']);
        $visitor = $request->user('sanctum');

        // An affiliate opening their own link is not a visit.
        if ($affiliate && (int) $affiliate->user_id !== (int) $visitor?->getKey()) {
            $program->recordVisit($affiliate, (string) $request->ip(), $request->userAgent(), $validated['path'] ?? null);
        }

        return response()->json([
            'data' => [
                'valid' => $affiliate !== null,
                'code' => $affiliate?->code,
                'cookie_days' => $program->settings()['cookie_days'],
            ],
        ]);
    }
}
