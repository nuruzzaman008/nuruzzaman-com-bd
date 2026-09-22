<?php

namespace App\Http\Requests\Admin;

use App\Models\Page;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PageRequest extends FormRequest
{
    /**
     * Addresses the site already answers itself. A new page is served at
     * /{slug}, so a page given one of these would sit behind the real route
     * and never be seen. Mirrors the top-level routes in apps/web/src/app and
     * the redirects in apps/web/next.config.ts.
     */
    public const RESERVED_SLUGS = [
        'about', 'account', 'ads', 'api', 'apple-icon', 'attachment', 'authors', 'blog',
        'cart', 'checkout', 'connect-autocad', 'contact', 'course-terms', 'courses',
        'dashboard', 'en', 'engineering-disclaimer', 'engineering-tools', 'faq', 'favicon',
        'feed', 'forgot-password', 'icon', 'learn', 'login', 'nb-engineering-tools',
        'nb-engineering-tools-autocad-structural-design-software', 'nb-staff',
        'opengraph-image', 'privacy-policy', 'products', 'refund-policy', 'register',
        'reset-password', 'resources', 'robots', 'sanctum', 'search', 'shop', 'sitemap',
        'software-eula', 'storage', 'support', 'terms', 'topics', 'verify',
    ];

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        /** @var Page|null $page */
        $page = $this->route('page');
        $creating = $this->isMethod('POST');

        return [
            'slug' => [
                $creating ? 'required' : 'sometimes',
                'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('pages', 'slug')->ignore($page?->getKey()),
                $this->slugIsFree($page),
            ],
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            // An empty page is a valid draft; the controller stores it as ''.
            'body_markdown' => [$creating ? 'present' : 'sometimes', 'nullable', 'string', 'max:200000'],
            'template' => ['sometimes', 'string', 'in:default,legal,support'],
            'requires_legal_review' => ['sometimes', 'boolean'],
            'seo' => ['sometimes', 'array'],
            'seo.meta_title' => ['nullable', 'string', 'max:255'],
            'seo.meta_description' => ['nullable', 'string', 'max:320'],
            'seo.focus_keyword' => ['nullable', 'string', 'max:160'],
            'seo.canonical_url' => ['nullable', 'url', 'max:512'],
            // The share image: the picture on share cards and in search results.
            'seo.og_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'seo.noindex' => ['sometimes', 'boolean'],
            'seo.nofollow' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * A page may keep the address it has; only a new or changed one is checked,
     * so the seeded /about page can still be saved under 'about'.
     *
     * An English document is its Bengali page's slug plus `-en`, served at that
     * page's /en address; one with no Bengali page could never be reached.
     */
    private function slugIsFree(?Page $page): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($page) {
            if (! is_string($value) || $value === $page?->slug) {
                return;
            }

            if (in_array($value, self::RESERVED_SLUGS, true)) {
                $fail('This address is already used by another part of the site. Choose a different one.');

                return;
            }

            if (str_ends_with($value, '-en')
                && ! Page::query()->where('slug', substr($value, 0, -3))->exists()) {
                $fail('An address ending in -en is the English version of a page. Create the Bengali page first.');
            }
        };
    }
}
