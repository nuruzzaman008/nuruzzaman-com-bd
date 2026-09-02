<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\SoftwareLicenseResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LicenseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $licenses = $request->user()->softwareLicenses()
            ->with(['order', 'machineBindings'])
            ->latest('id')
            ->get();

        return SoftwareLicenseResource::collection($licenses);
    }
}
