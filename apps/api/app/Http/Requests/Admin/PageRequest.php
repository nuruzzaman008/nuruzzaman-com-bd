<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $pageId = $this->route('page')?->getKey();

        return [
            'slug' => [
                $this->isMethod('POST') ? 'required' : 'sometimes',
                'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('pages', 'slug')->ignore($pageId),
            ],
            'title' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:255'],
            'body_markdown' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:200000'],
            'template' => ['sometimes', 'string', 'in:default,legal,support'],
            'requires_legal_review' => ['sometimes', 'boolean'],
            'seo' => ['sometimes', 'array'],
            'seo.meta_title' => ['nullable', 'string', 'max:255'],
            'seo.meta_description' => ['nullable', 'string', 'max:320'],
            'seo.focus_keyword' => ['nullable', 'string', 'max:160'],
            'seo.canonical_url' => ['nullable', 'url', 'max:512'],
            'seo.noindex' => ['sometimes', 'boolean'],
        ];
    }
}
