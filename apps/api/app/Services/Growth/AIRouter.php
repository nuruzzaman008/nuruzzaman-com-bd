<?php

namespace App\Services\Growth;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class AIRouter
{
    public function __construct(private HttpAIProvider $adapter) {}

    public function run(int $userId, array $messages, string $feature = 'general', ?int $only = null): array
    {
        $providers = DB::table('growth_ai_providers')->where('user_id', $userId)->whereNotNull('secret');
        if ($only) {
            $providers->where('id', $only);
        } else {
            $providers->where('enabled', true)->whereIn('purpose', [$feature, 'general']);
        }
        foreach ($providers->orderByDesc('is_default')->orderBy('priority')->orderBy('id')->limit(3)->get() as $candidate) {
            $result = DB::transaction(function () use ($candidate, $userId, $messages, $feature) {
                $p = DB::table('growth_ai_providers')->where('id', $candidate->id)->lockForUpdate()->first();
                $started = microtime(true);
                $upperCost = null;
                if ($p->input_rate !== null && $p->output_rate !== null) {
                    $bytes = strlen(json_encode($messages)) + 4096;
                    $upperCost = ($bytes * (float) $p->input_rate + 1024 * (float) $p->output_rate) / 1000000;
                }
                $spent = DB::table('growth_ai_logs')->where('provider_id', $p->id)->where('created_at', '>=', now()->startOfMonth())->sum('estimated_cost');
                if ($p->monthly_budget !== null && ($upperCost === null || $spent + $upperCost > (float) $p->monthly_budget)) {
                    return null;
                }
                try {
                    $answer = $this->adapter->chat($p, $messages);
                    $status = 'success';
                    $error = null;
                    $cost = $upperCost;
                    if ($upperCost !== null && $answer['input_tokens'] !== null && $answer['output_tokens'] !== null) {
                        $cost = ($answer['input_tokens'] * (float) $p->input_rate + $answer['output_tokens'] * (float) $p->output_rate) / 1000000;
                    }
                } catch (Throwable $e) {
                    $answer = null;
                    $status = 'error';
                    $error = 'provider_unavailable';
                    $cost = $upperCost;
                }
                DB::table('growth_ai_logs')->insert(['user_id' => $userId, 'provider_id' => $p->id, 'provider' => $p->provider, 'model' => $p->model, 'feature' => $feature, 'status' => $status, 'duration_ms' => (int) ((microtime(true) - $started) * 1000), 'input_tokens' => $answer['input_tokens'] ?? null, 'output_tokens' => $answer['output_tokens'] ?? null, 'estimated_cost' => $cost, 'error_code' => $error, 'created_at' => now(), 'updated_at' => now()]);
                DB::table('growth_ai_providers')->where('id', $p->id)->update(['connection_status' => $answer ? 'connected' : 'error', 'checked_at' => now()]);

                return $answer ? $answer + ['provider' => $p->provider, 'model' => $p->model] : null;
            });
            if ($result) {
                return $result;
            }
        }
        throw ValidationException::withMessages(['provider' => 'AI is not configured, its budget is unavailable, or the configured providers failed. Check AI Settings and test the connection.']);
    }
}
