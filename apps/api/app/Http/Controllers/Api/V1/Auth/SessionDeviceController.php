<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Lets a customer see and revoke their own signed-in devices. Only works when
 * the session driver stores rows in the database; with Redis the endpoint
 * reports that device listing is unavailable rather than inventing a list.
 */
class SessionDeviceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (config('session.driver') !== 'database') {
            return response()->json(['data' => [], 'available' => false]);
        }

        $sessions = DB::table('sessions')
            ->where('user_id', $request->user()->getKey())
            ->orderByDesc('last_activity')
            ->get()
            ->map(fn ($row) => [
                'id' => hash('sha256', $row->id),
                'ip_address' => $row->ip_address,
                'user_agent' => $row->user_agent,
                'last_active_at' => now()->setTimestamp((int) $row->last_activity)->toIso8601String(),
                'is_current' => $row->id === $request->session()->getId(),
            ]);

        return response()->json(['data' => $sessions, 'available' => true]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        abort_unless(config('session.driver') === 'database', 400, 'Device management needs the database session driver.');

        $rows = DB::table('sessions')->where('user_id', $request->user()->getKey())->get();

        foreach ($rows as $row) {
            if (hash('sha256', $row->id) === $id && $row->id !== $request->session()->getId()) {
                DB::table('sessions')->where('id', $row->id)->delete();
                Audit::record('auth.session_revoked', $request->user(), [], $request->user()->getKey());

                return response()->json(['message' => 'Device signed out.']);
            }
        }

        abort(404, 'That device was not found.');
    }
}
