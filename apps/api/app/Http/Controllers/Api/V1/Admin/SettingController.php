<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('settings.manage'), 403);

        return response()->json(['data' => Setting::query()->orderBy('group')->orderBy('key')->get()]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('settings.manage'), 403);

        $validated = $request->validate([
            'settings' => ['required', 'array', 'min:1', 'max:50'],
            'settings.*.key' => ['required', 'string', 'max:128'],
            'settings.*.group' => ['sometimes', 'string', 'max:64'],
            'settings.*.value' => ['present'],
            'settings.*.is_public' => ['sometimes', 'boolean'],
        ]);

        foreach ($validated['settings'] as $row) {
            Setting::query()->updateOrCreate(
                ['key' => $row['key']],
                [
                    'group' => $row['group'] ?? 'general',
                    'value' => $row['value'],
                    'is_public' => $row['is_public'] ?? false,
                ],
            );
        }

        Audit::record('settings.updated', null, [
            'keys' => array_column($validated['settings'], 'key'),
        ]);

        return response()->json(['data' => Setting::query()->orderBy('group')->orderBy('key')->get()]);
    }
}
