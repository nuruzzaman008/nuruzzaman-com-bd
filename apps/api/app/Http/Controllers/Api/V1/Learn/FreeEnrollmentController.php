<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Enums\EnrollmentStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProductVariant;
use App\Services\Lms\EnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Joining a free course.
 *
 * Checkout refuses an order for nothing - the payment gateway cannot take a
 * zero amount - so a course whose price is zero is joined here instead. The
 * price is checked on the server every time; a course that stops being free
 * stops being joinable this way at once.
 */
class FreeEnrollmentController extends Controller
{
    public function __construct(private readonly EnrollmentService $enrollments) {}

    public function store(Request $request, string $courseSlug): JsonResponse
    {
        // Published as the public pages count it - with at least one lesson -
        // so nothing visitors cannot see can be joined.
        $course = Course::query()
            ->published()
            ->where('slug', $courseSlug)
            ->with('purchasableVariants.prices')
            ->firstOrFail();

        $isFree = $course->purchasableVariants->contains(function (ProductVariant $variant) {
            $price = $variant->currentPrice();

            return $price !== null && $price->currency === 'BDT' && $price->amount_minor === 0;
        });

        if (! $isFree) {
            throw new DomainException('This course is not free. Enrol through checkout instead.');
        }

        $user = $request->user();
        $existing = Enrollment::query()
            ->where('user_id', $user->getKey())
            ->where('course_id', $course->getKey())
            ->first();

        // Joining again must not undo an administrator's decision.
        if ($existing?->status === EnrollmentStatus::Revoked) {
            throw DomainException::forbidden('Your access to this course was withdrawn. Please contact support.');
        }

        $already = $existing !== null && $existing->isUsable();
        $enrollment = $already ? $existing : $this->enrollments->enroll($user, $course, null, 'free');

        return response()->json([
            'data' => [
                'course_slug' => $course->slug,
                'status' => $enrollment->status->value,
                'learn_url' => '/learn/'.$course->slug,
            ],
        ], $already ? 200 : 201);
    }
}
