<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RevalidateFrontend;
use App\Models\Redirect;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RedirectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->guard($request);

        return response()->json(['data' => Redirect::query()->orderBy('source_path')->paginate(100)]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            // Both sides must be site-relative, so a redirect can never be used
            // as an open redirect to another host.
            'source_path' => ['required', 'string', 'max:512', 'regex:#^/[^\s]*$#', 'unique:redirects,source_path'],
            'destination_path' => ['required', 'string', 'max:512', 'regex:#^/[^\s]*$#'],
            'status_code' => ['sometimes', 'integer', 'in:301,302,307,308'],
            'is_active' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $redirect = Redirect::create($validated);
        Audit::record('redirect.created', $redirect, $validated);
        RevalidateFrontend::dispatch(['redirects']);

        return response()->json(['data' => $redirect], 201);
    }

    public function update(Request $request, Redirect $redirect): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'source_path' => ['sometimes', 'string', 'max:512', 'regex:#^/[^\s]*$#', Rule::unique('redirects', 'source_path')->ignore($redirect->getKey())],
            'destination_path' => ['sometimes', 'string', 'max:512', 'regex:#^/[^\s]*$#'],
            'status_code' => ['sometimes', 'integer', 'in:301,302,307,308'],
            'is_active' => ['sometimes', 'boolean'],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $redirect->update($validated);
        RevalidateFrontend::dispatch(['redirects']);

        return response()->json(['data' => $redirect->fresh()]);
    }

    public function destroy(Request $request, Redirect $redirect): JsonResponse
    {
        $this->guard($request);
        $redirect->delete();
        RevalidateFrontend::dispatch(['redirects']);

        return response()->json(['message' => 'Redirect deleted.']);
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('redirects.manage'), 403);
    }
}
