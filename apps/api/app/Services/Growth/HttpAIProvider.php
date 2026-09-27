<?php

namespace App\Services\Growth;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class HttpAIProvider implements AIProviderInterface
{
    public function chat(object $provider, array $messages): array
    {
        $base = match ($provider->provider) {
            'openai' => 'https://api.openai.com/v1',
            'openrouter' => 'https://openrouter.ai/api/v1',
            'gemini' => 'https://generativelanguage.googleapis.com/v1beta',
            'anthropic' => 'https://api.anthropic.com/v1',
            'custom' => rtrim($provider->base_url ?? '', '/'),
            default => throw new RuntimeException('unsupported_provider'),
        };
        if ($provider->provider === 'custom' && (! in_array($base, config('growth.custom_base_urls', []), true) || ! str_starts_with($base, 'https://'))) {
            throw new RuntimeException('custom_endpoint_not_allowed');
        }
        $key = Crypt::decryptString($provider->secret);
        $http = Http::acceptJson()->connectTimeout(5)->timeout(20)->withOptions(['allow_redirects' => false]);
        if ($provider->provider === 'gemini') {
            $system = implode("\n", array_column(array_filter($messages, fn ($m) => $m['role'] === 'system'), 'content'));
            $contents = array_values(array_map(fn ($m) => ['role' => $m['role'] === 'assistant' ? 'model' : 'user', 'parts' => [['text' => $m['content']]]], array_filter($messages, fn ($m) => $m['role'] !== 'system')));
            $r = $http->withHeaders(['x-goog-api-key' => $key])->post($base.'/models/'.rawurlencode($provider->model).':generateContent', ['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => $contents, 'generationConfig' => ['maxOutputTokens' => 1024]]);
            $text = implode('', array_column($r->json('candidates.0.content.parts', []), 'text'));
            $in = $r->json('usageMetadata.promptTokenCount');
            $out = $r->json('usageMetadata.candidatesTokenCount');
        } elseif ($provider->provider === 'anthropic') {
            $r = $http->withHeaders(['x-api-key' => $key, 'anthropic-version' => '2023-06-01'])->post($base.'/messages', ['model' => $provider->model, 'max_tokens' => 1024, 'system' => implode("\n", array_column(array_filter($messages, fn ($m) => $m['role'] === 'system'), 'content')), 'messages' => array_values(array_filter($messages, fn ($m) => $m['role'] !== 'system'))]);
            $text = implode('', array_column($r->json('content', []), 'text'));
            $in = $r->json('usage.input_tokens');
            $out = $r->json('usage.output_tokens');
        } else {
            $r = $http->withToken($key)->post($base.'/chat/completions', ['model' => $provider->model, 'messages' => $messages, 'max_completion_tokens' => 1024]);
            $text = $r->json('choices.0.message.content');
            $in = $r->json('usage.prompt_tokens');
            $out = $r->json('usage.completion_tokens');
        }
        if (! $r->successful() || ! is_string($text) || trim($text) === '') {
            throw new RuntimeException('provider_response_invalid');
        }

        return ['text' => mb_substr($text, 0, 20000), 'input_tokens' => is_int($in) ? $in : null, 'output_tokens' => is_int($out) ? $out : null];
    }
}
