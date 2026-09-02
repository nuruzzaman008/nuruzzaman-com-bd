<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            // RFC validation only. A DNS lookup here would make sign-up depend on
            // outbound DNS being reachable, which fails closed on a blip.
            'email' => ['required', 'string', 'email:rfc', 'max:191', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['required', 'confirmed', Password::min(10)->letters()->numbers()->uncompromised()],
            'accepts_terms' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'accepts_terms.accepted' => 'You must accept the terms and the privacy policy to create an account.',
        ];
    }
}
