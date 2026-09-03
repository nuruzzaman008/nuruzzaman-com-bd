<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $postId = $this->route('post')?->getKey();

        return [
            'slug' => [
                $this->isMethod('POST') ? 'required' : 'sometimes',
                'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('posts', 'slug')->ignore($postId),
            ],
            'title' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:255'],
            'excerpt' => ['nullable', 'string', 'max:512'],
            // Markdown source. Raw HTML is stripped at render time rather than
            // stored as trusted markup, so the frontend never sanitises input.
            'body_markdown' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:200000'],
            'author_id' => ['nullable', 'integer', 'exists:authors,id'],
            'reviewed_by_author_id' => ['nullable', 'integer', 'exists:authors,id'],
            'reviewed_at' => ['nullable', 'date'],
            'cover_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'funnel_stage' => ['nullable', 'string', 'in:awareness,consideration,decision'],
            'search_intent' => ['nullable', 'string', 'in:informational,commercial,transactional,navigational'],
            'scheduled_for' => ['nullable', 'date', 'after:now'],
            'category_ids' => ['sometimes', 'array', 'max:5'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'tag_ids' => ['sometimes', 'array', 'max:12'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
            'seo' => ['sometimes', 'array'],
            'seo.meta_title' => ['nullable', 'string', 'max:255'],
            'seo.meta_description' => ['nullable', 'string', 'max:320'],
            'seo.focus_keyword' => ['nullable', 'string', 'max:160'],
            'seo.canonical_url' => ['nullable', 'url', 'max:512'],
            'seo.og_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'seo.noindex' => ['sometimes', 'boolean'],
            'seo.nofollow' => ['sometimes', 'boolean'],
        ];
    }
}
