<?php

namespace App\Http\Requests\Commerce;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            // Digital-only: no shipping fields are collected or stored.
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'email' => ['required', 'email:rfc', 'max:191'],
            'phone' => ['nullable', 'string', 'max:32'],
            'accepts_terms' => ['accepted'],
            'accepts_privacy' => ['accepted'],
            'accepts_refund_policy' => ['accepted'],
            'accepts_eula' => ['sometimes', 'accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'accepts_terms.accepted' => 'Please accept the terms of service.',
            'accepts_privacy.accepted' => 'Please accept the privacy policy.',
            'accepts_refund_policy.accepted' => 'Please accept the refund policy.',
        ];
    }

    /**
     * The exact acceptances recorded against the order, so a later dispute can
     * be answered with what the customer actually agreed to.
     *
     * @return array<int, string>
     */
    public function acceptedTerms(): array
    {
        return collect(['terms', 'privacy', 'refund_policy', 'eula'])
            ->filter(fn (string $key) => $this->boolean('accepts_'.$key))
            ->values()
            ->all();
    }
}
