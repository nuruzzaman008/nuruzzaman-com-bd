<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class WalletHistoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->attributes->has('wallet_device');
    }

    public function rules(): array
    {
        return [
            'cursor' => ['sometimes', 'string', 'regex:/^[1-9][0-9]{0,17}$/'],
            'limit' => ['sometimes', 'integer', 'between:1,100'],
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
