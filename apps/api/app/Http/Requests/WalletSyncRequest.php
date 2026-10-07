<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class WalletSyncRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->attributes->has('wallet_device');
    }

    public function rules(): array
    {
        return [
            'request_id' => ['required', 'uuid'],
            'lease_id' => ['required', 'uuid'],
            'expected_version' => ['required', 'integer:strict', 'min:0', 'max:2147483647'],
            'transactions' => ['required', 'array', 'list', 'min:1', 'max:'.config('offline_wallet.max_batch_size')],
            'transactions.*' => ['required', 'array:transaction_id,sequence,command,units,occurred_at'],
            'transactions.*.transaction_id' => ['required', 'uuid', 'distinct:ignore_case'],
            'transactions.*.sequence' => ['required', 'integer:strict', 'min:1', 'max:2147483647', 'distinct'],
            'transactions.*.command' => ['required', 'string', 'regex:/^[A-Z0-9_]{1,80}$/'],
            'transactions.*.units' => ['required', 'integer:strict', 'between:1,10000'],
            'transactions.*.occurred_at' => ['required', 'date_format:Y-m-d\\TH:i:s\\Z'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $allowed = array_filter(array_keys($this->rules()), fn ($key) => ! str_contains($key, '.'));
            if (array_diff(array_keys($this->all()), $allowed)) {
                $validator->errors()->add('request', 'Unknown request fields are not allowed.');
            }
        }];
    }
}
