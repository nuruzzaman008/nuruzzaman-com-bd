<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * The language a request asked for, and how to answer it.
 *
 * Read from `?locale=`, never from Accept-Language: the front end decides the
 * language from the URL the visitor is on, and a header that disagreed with it
 * would put an English page's data on a Bengali page. It also has to stay a
 * query parameter for caching - a response that varied by header while the URL
 * stayed the same would be cached under the wrong language.
 *
 * Falls back to the Bengali value whenever the English one has not been
 * written. Nothing is machine translated here.
 */
final class RequestLocale
{
    public static function isEnglish(Request $request): bool
    {
        return $request->query('locale') === 'en';
    }

    /** The English value if it was asked for and exists, else the Bengali one. */
    public static function pick(Request $request, ?string $bengali, ?string $english): ?string
    {
        if (! self::isEnglish($request)) {
            return $bengali;
        }

        return filled($english) ? $english : $bengali;
    }

    /**
     * Whether what is being returned is in the language that was asked for.
     *
     * Lets a page say "this has not been translated yet" instead of quietly
     * serving a language the reader did not choose.
     */
    public static function translated(Request $request, ?string $english): bool
    {
        return ! self::isEnglish($request) || filled($english);
    }
}
