<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

class ActivationRequestStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'order_number' => ['required', 'string', 'exists:orders,number'],
            'license_code' => ['nullable', 'string', 'max:64'],
            // Uploading a recovery file is deliberately not accepted here.
            'machine_id' => ['required', 'string', 'min:8', 'max:128', 'regex:/^[A-Za-z0-9\-:_ ]+$/'],
            'request_type' => ['sometimes', 'string', 'in:activation,refill,recovery'],
            'autocad_version' => ['nullable', 'string', 'max:32'],
            'windows_version' => ['nullable', 'string', 'max:64'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'machine_id.regex' => 'A Machine ID may only contain letters, digits, spaces, dashes, colons and underscores.',
        ];
    }
}
