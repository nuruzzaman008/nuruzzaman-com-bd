<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GrowthRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('super_admin') ?? false;
    }

    public function rules(): array
    {
        $rules = ['title' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:12000'], 'category' => ['sometimes', 'string', 'max:80'], 'status' => ['sometimes', Rule::in(['pending', 'in_progress', 'completed', 'skipped', 'archived'])]];
        $type = $this->route('kind');
        if (in_array($type, ['goals', 'tasks'])) {
            $rules['priority'] = ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])];
        }
        if ($type === 'goals') {
            $rules += ['parent_id' => ['nullable', 'integer', Rule::exists('growth_goals', 'id')->where('user_id', $this->user()->id)], 'horizon' => ['sometimes', Rule::in(['vision', 'long_term', 'annual', 'quarterly', 'monthly', 'weekly', 'daily'])], 'why' => ['nullable', 'string', 'max:5000'], 'notes' => ['nullable', 'string', 'max:12000'], 'start_date' => ['nullable', 'date_format:Y-m-d'], 'target_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'], 'progress' => ['sometimes', 'integer', 'between:0,100']];
        }
        if ($type === 'tasks') {
            $rules += ['goal_id' => ['nullable', 'integer', Rule::exists('growth_goals', 'id')->where('user_id', $this->user()->id)], 'due_at' => ['nullable', 'date'], 'source' => ['sometimes', 'string', 'max:100'], 'focus_date' => ['nullable', 'date_format:Y-m-d', 'required_with:focus_rank'], 'focus_rank' => ['nullable', 'integer', 'between:1,3', 'required_with:focus_date']];
        }

        return $rules;
    }
}
