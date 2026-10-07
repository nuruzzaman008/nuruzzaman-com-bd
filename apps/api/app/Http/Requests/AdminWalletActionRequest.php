<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class AdminWalletActionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isStaff() && $this->user()->hasPermission('wallets.manage');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'transaction_id' => ['required', 'uuid'],
            'expected_version' => ['required', 'integer:strict', 'min:0', 'max:2147483646'],
            'action' => ['required', 'in:add,deduct,status,license_status,reset_device'],
            'amount' => ['required_if:action,add,deduct', 'prohibited_unless:action,add,deduct', 'integer:strict', 'between:1,1000000'],
            'status' => ['required_if:action,status,license_status', 'prohibited_unless:action,status,license_status', 'in:active,suspended,blocked'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
            'reference_note' => ['required', 'string', 'max:500'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), array_keys($this->rules()))) {
                $validator->errors()->add('request', 'Unknown fields are not allowed. Admin identity is taken from the session.');
            }
        }];
    }
}
