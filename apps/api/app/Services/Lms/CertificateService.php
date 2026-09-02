<?php

namespace App\Services\Lms;

use App\Models\Certificate;
use App\Models\Enrollment;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;

/**
 * Certificates are issued once per completed enrolment and carry a public
 * verification id so a third party can confirm one without an account.
 */
class CertificateService
{
    public function issue(Enrollment $enrollment): Certificate
    {
        $enrollment->loadMissing(['user', 'course']);

        /** @var Certificate $certificate */
        $certificate = Certificate::query()->firstOrCreate(
            ['enrollment_id' => $enrollment->getKey()],
            [
                'user_id' => $enrollment->user_id,
                'course_id' => $enrollment->course_id,
                'verification_id' => Reference::certificate(),
                'recipient_name' => $enrollment->user->name,
                'course_title' => $enrollment->course->title,
                'score_percent' => $enrollment->progress_percent,
                'issued_at' => now(),
            ],
        );

        if (! $certificate->document_path) {
            $this->render($certificate);
        }

        Audit::record('certificate.issued', $certificate, [
            'course' => $enrollment->course->slug,
        ], $enrollment->user_id);

        return $certificate->refresh();
    }

    /**
     * Renders a self-contained HTML certificate onto the private disk. A PDF
     * converter can be pointed at this file later without changing the data
     * model; no paid PDF dependency is pulled in for it.
     */
    private function render(Certificate $certificate): void
    {
        $disk = config('nb.downloads.disk');
        $path = 'certificates/'.$certificate->verification_id.'.html';

        Storage::disk($disk)->put($path, View::make('documents.certificate', [
            'certificate' => $certificate,
            'site' => config('nb.site'),
        ])->render());

        $certificate->update(['document_disk' => $disk, 'document_path' => $path]);
    }
}
