<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Affiliate;
use App\Models\AffiliateCommission;
use App\Services\Affiliates\AffiliateLedger;
use App\Services\Affiliates\AffiliateProgram;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The affiliate program from the owner's side: its rate, its members, and paying them. */
class AffiliateController extends Controller
{
    public function __construct(
        private readonly AffiliateProgram $program,
        private readonly AffiliateLedger $ledger,
    ) {}

    public function settings(Request $request): JsonResponse
    {
        $this->guard($request);

        return response()->json(['data' => $this->program->settings()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'default_rate' => ['sometimes', 'numeric', 'min:0', 'max:90'],
            'cookie_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'hold_days' => ['sometimes', 'integer', 'min:0', 'max:90'],
            'min_payout_minor' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
        ]);

        return response()->json(['data' => $this->program->saveSettings($validated, $request->user())]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->guard($request);

        $term = trim((string) $request->query('q', ''));
        $status = $request->query('status');
        $settings = $this->program->settings();

        $page = $this->ledger->withAggregates(Affiliate::query()->with('user:id,name,email'))
            ->when($term !== '', function ($query) use ($term) {
                $like = '%'.addcslashes($term, '%_\\').'%';

                $query->where(fn ($inner) => $inner
                    ->where('code', 'like', $like)
                    ->orWhereHas('user', fn ($user) => $user->where('name', 'like', $like)->orWhere('email', 'like', $like)));
            })
            ->when(
                in_array($status, [Affiliate::STATUS_ACTIVE, Affiliate::STATUS_SUSPENDED], true),
                fn ($query) => $query->where('status', $status),
            )
            ->latest('id')
            ->paginate(50);

        return response()->json([
            'data' => collect($page->items())
                ->map(fn (Affiliate $affiliate) => $this->row(
                    $affiliate,
                    $this->ledger->summaryFromAggregates($affiliate),
                    $settings['default_rate'],
                ))
                ->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
            'totals' => $this->ledger->programTotals(),
            'settings' => $settings,
        ]);
    }

    public function show(Request $request, Affiliate $affiliate): JsonResponse
    {
        $this->guard($request);

        return response()->json(['data' => $this->detail($affiliate)]);
    }

    public function update(Request $request, Affiliate $affiliate): JsonResponse
    {
        $this->guard($request);

        if ($request->has('code')) {
            $request->merge(['code' => $this->program->normalizeCode($request->input('code'))]);
        }

        $validated = $request->validate([
            'code' => ['sometimes', ...$this->program->codeRules($affiliate->getKey())],
            'status' => ['sometimes', Rule::in([Affiliate::STATUS_ACTIVE, Affiliate::STATUS_SUSPENDED])],
            // Null puts the affiliate back on the program's default rate.
            'commission_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:90'],
            'admin_note' => ['sometimes', 'nullable', 'string', 'max:500'],
        ], $this->program->codeMessages());

        $before = $affiliate->only(array_keys($validated));
        $affiliate->update($validated);

        Audit::record('affiliate.updated', $affiliate, [
            'before' => $before,
            'after' => $affiliate->only(array_keys($validated)),
        ], $request->user()->getKey());

        return response()->json(['data' => $this->detail($affiliate->fresh())]);
    }

    /** Records a payment the owner has already made outside the site. */
    public function storePayout(Request $request, Affiliate $affiliate): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'amount_minor' => ['required', 'integer', 'min:1'],
            'method' => ['required', Rule::in(AffiliateProgram::PAYOUT_METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:500'],
            'paid_at' => ['nullable', 'date', 'before_or_equal:now'],
        ]);

        $this->ledger->recordPayout($affiliate, $validated, $request->user());

        return response()->json(['data' => $this->detail($affiliate->fresh())], 201);
    }

    public function voidCommission(Request $request, AffiliateCommission $commission): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate(['reason' => ['required', 'string', 'max:250']]);

        $this->ledger->voidCommission($commission, $validated['reason'], $request->user());

        return response()->json(['data' => $this->detail($commission->affiliate()->firstOrFail())]);
    }

    private function detail(Affiliate $affiliate): array
    {
        $affiliate->loadMissing('user:id,name,email,phone');
        $settings = $this->program->settings();

        $commissions = $affiliate->commissions()->with('order.items')->latest('id')->limit(500)->get();
        $payouts = $affiliate->payouts()->with('recorder:id,name')->latest('paid_at')->latest('id')->get();

        return $this->row($affiliate, $this->ledger->summary($affiliate), $settings['default_rate']) + [
            'phone' => $affiliate->user?->phone,
            'payout_method' => $affiliate->payout_method,
            'payout_account' => $affiliate->payout_account,
            'payout_name' => $affiliate->payout_name,
            'admin_note' => $affiliate->admin_note,
            'commissions' => $commissions->map(fn ($commission) => $this->ledger->commissionRow($commission, true))->all(),
            'payouts' => $payouts->map(fn ($payout) => $this->ledger->payoutRow($payout, true))->all(),
            'settings' => $settings,
        ];
    }

    private function row(Affiliate $affiliate, array $stats, float $defaultRate): array
    {
        return [
            'id' => $affiliate->id,
            'code' => $affiliate->code,
            'status' => $affiliate->status,
            'commission_rate' => $affiliate->commission_rate !== null ? (float) $affiliate->commission_rate : null,
            'rate' => $this->program->rateFor($affiliate, $defaultRate),
            'user' => $affiliate->user ? [
                'id' => $affiliate->user->id,
                'name' => $affiliate->user->name,
                'email' => $affiliate->user->email,
            ] : null,
            'joined_at' => $affiliate->created_at?->toIso8601String(),
            'stats' => $stats,
        ];
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('affiliates.manage'), 403);
    }
}
