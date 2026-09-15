<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Affiliate;
use App\Services\Affiliates\AffiliateLedger;
use App\Services\Affiliates\AffiliateProgram;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** A customer's own affiliate membership: their link, earnings and payouts. */
class AffiliateController extends Controller
{
    public function __construct(
        private readonly AffiliateProgram $program,
        private readonly AffiliateLedger $ledger,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->own($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $existing = $this->own($request);

        if ($existing) {
            return response()->json(['data' => $this->payload($existing)]);
        }

        $this->normalizeCode($request);

        $validated = $request->validate([
            'code' => ['sometimes', 'nullable', ...$this->program->codeRules(null)],
        ], $this->program->codeMessages());

        $affiliate = $this->program->join($request->user(), $validated['code'] ?? null);

        return response()->json(['data' => $this->payload($affiliate)], 201);
    }

    public function update(Request $request): JsonResponse
    {
        $affiliate = $this->own($request) ?? abort(404, 'Join the affiliate program first.');

        $this->normalizeCode($request);

        $validated = $request->validate([
            'code' => ['sometimes', ...$this->program->codeRules($affiliate->getKey())],
            'payout_method' => ['sometimes', 'nullable', Rule::in(AffiliateProgram::PAYOUT_METHODS)],
            'payout_account' => ['sometimes', 'nullable', 'string', 'max:100'],
            'payout_name' => ['sometimes', 'nullable', 'string', 'max:100'],
        ], $this->program->codeMessages());

        $previousCode = $affiliate->code;

        if (isset($validated['code']) && $validated['code'] !== $previousCode && ! $affiliate->isActive()) {
            throw DomainException::forbidden('A suspended affiliate account cannot change its link.');
        }

        $affiliate->update($validated);

        if ($affiliate->code !== $previousCode) {
            Audit::record('affiliate.code_changed', $affiliate, [
                'from' => $previousCode,
                'to' => $affiliate->code,
            ], $request->user()->getKey());
        }

        return response()->json(['data' => $this->payload($affiliate->fresh())]);
    }

    private function own(Request $request): ?Affiliate
    {
        return Affiliate::query()->where('user_id', $request->user()->getKey())->first();
    }

    private function normalizeCode(Request $request): void
    {
        if ($request->has('code')) {
            $request->merge(['code' => $this->program->normalizeCode($request->input('code'))]);
        }
    }

    private function payload(?Affiliate $affiliate): array
    {
        $settings = $this->program->settings();

        return [
            'program' => $settings + [
                'currency' => 'BDT',
                'payout_methods' => AffiliateProgram::PAYOUT_METHODS,
            ],
            'affiliate' => $affiliate === null ? null : [
                'code' => $affiliate->code,
                'status' => $affiliate->status,
                'rate' => $this->program->rateFor($affiliate, $settings['default_rate']),
                'payout_method' => $affiliate->payout_method,
                'payout_account' => $affiliate->payout_account,
                'payout_name' => $affiliate->payout_name,
                'joined_at' => $affiliate->created_at?->toIso8601String(),
                'stats' => $this->ledger->summary($affiliate),
                'commissions' => $affiliate->commissions()
                    ->with('order.items')
                    ->latest('id')
                    ->limit(200)
                    ->get()
                    ->map(fn ($commission) => $this->ledger->commissionRow($commission))
                    ->all(),
                'payouts' => $affiliate->payouts()
                    ->latest('paid_at')
                    ->latest('id')
                    ->get()
                    ->map(fn ($payout) => $this->ledger->payoutRow($payout))
                    ->all(),
            ],
        ];
    }
}
