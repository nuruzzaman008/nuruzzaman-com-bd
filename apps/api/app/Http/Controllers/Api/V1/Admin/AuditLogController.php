<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('audit.view'), 403);

        $validated = $request->validate([
            'action' => ['sometimes', 'string', 'max:96'],
            'user_id' => ['sometimes', 'integer'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = AuditLog::query()
            ->with('user:id,name,email')
            ->when($validated['action'] ?? null, fn ($query, $action) => $query->where('action', $action))
            ->when($validated['user_id'] ?? null, fn ($query, $userId) => $query->where('user_id', $userId))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 50);

        return response()->json($logs->through(fn (AuditLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'actor' => $log->user?->only(['id', 'name', 'email']),
            'subject_type' => $log->auditable_type,
            'subject_id' => $log->auditable_id,
            'context' => $log->context,
            'ip_address' => $log->ip_address,
            'request_id' => $log->request_id,
            'at' => $log->created_at?->toIso8601String(),
        ])->toArray());
    }
}
