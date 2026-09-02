<?php

namespace App\Jobs;

use App\Models\Enrollment;
use App\Services\Lms\CertificateService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class IssueCertificate implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $enrollmentId) {}

    public function uniqueId(): string
    {
        return (string) $this->enrollmentId;
    }

    public function handle(CertificateService $certificates): void
    {
        $enrollment = Enrollment::query()->with(['user', 'course'])->find($this->enrollmentId);

        if ($enrollment && $enrollment->completed_at) {
            $certificates->issue($enrollment);
        }
    }
}
