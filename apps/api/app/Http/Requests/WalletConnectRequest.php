<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class WalletConnectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->attributes->has('wallet_device');
    }

    public function rules(): array
    {
        return [
            'request_id' => ['required', 'uuid'],
            'expected_version' => ['required', 'integer:strict', 'min:0', 'max:2147483647'],
            'requested_allowance' => ['required', 'integer:strict', 'min:1', 'max:'.config('offline_wallet.max_allowance')],
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
