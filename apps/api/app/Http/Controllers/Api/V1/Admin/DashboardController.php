<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ActivationRequestStatus;
use App\Enums\ContentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\SupportTicketStatus;
use App\Http\Controllers\Controller;
use App\Models\ActivationRequest;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Post;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $since = now()->subDays(30);

        return response()->json([
            'data' => [
                'window_days' => 30,
                'revenue' => [
                    'currency' => config('nb.site.currency'),
                    // Only validated payments count as revenue.
                    'settled_minor' => (int) Payment::query()
                        ->where('status', PaymentStatus::Validated->value)
                        ->where('validated_at', '>=', $since)
                        ->sum('settled_amount_minor'),
                    'refunded_minor' => (int) Order::query()
                        ->where('updated_at', '>=', $since)
                        ->sum('refunded_minor'),
                ],
                'orders' => [
                    'paid' => Order::query()->whereIn('status', [
                        OrderStatus::Paid->value, OrderStatus::Fulfilled->value,
                    ])->where('paid_at', '>=', $since)->count(),
                    'pending' => Order::query()->where('status', OrderStatus::PendingPayment->value)->count(),
                    'failed' => Order::query()->where('status', OrderStatus::Failed->value)
                        ->where('updated_at', '>=', $since)->count(),
                ],
                'attention' => [
                    'payments_on_risk_hold' => Payment::query()
                        ->where('status', PaymentStatus::RiskHold->value)->count(),
                    'activation_requests_open' => ActivationRequest::query()->whereIn('status', [
                        ActivationRequestStatus::Submitted->value,
                        ActivationRequestStatus::UnderReview->value,
                        ActivationRequestStatus::NeedsInfo->value,
                    ])->count(),
                    'support_tickets_open' => SupportTicket::query()->whereIn('status', [
                        SupportTicketStatus::Open->value, SupportTicketStatus::Pending->value,
                    ])->count(),
                    'posts_in_review' => Post::query()->where('status', ContentStatus::InReview->value)->count(),
                ],
                'learning' => [
                    'active_enrollments' => Enrollment::query()->where('status', 'active')->count(),
                    'completions' => Enrollment::query()->whereNotNull('completed_at')
                        ->where('completed_at', '>=', $since)->count(),
                ],
            ],
        ]);
    }
}
