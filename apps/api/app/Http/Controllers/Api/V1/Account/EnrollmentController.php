<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\CertificateResource;
use App\Http\Resources\EnrollmentResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EnrollmentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $enrollments = $request->user()->enrollments()
            ->with(['course.cover', 'lastLesson', 'certificate'])
            ->latest('id')
            ->get();

        return EnrollmentResource::collection($enrollments);
    }

    public function certificates(Request $request): AnonymousResourceCollection
    {
        $certificates = $request->user()->certificates()
            ->with('course')
            ->latest('issued_at')
            ->get();

        return CertificateResource::collection($certificates);
    }
}
