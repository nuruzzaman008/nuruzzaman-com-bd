<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Server-side Markdown rendering. Raw HTML in author input is stripped rather
 * than escaped, and unsafe links are dropped, so stored content can never
 * introduce script into a rendered page.
 */
final class Markdown
{
    private const OPTIONS = [
        'html_input' => 'strip',
        'allow_unsafe_links' => false,
        'max_nesting_level' => 32,
    ];

    public static function toHtml(?string $markdown): string
    {
        if (blank($markdown)) {
            return '';
        }

        // Underline, colour, size and font survive as a closed list of our own
        // tags; every other piece of raw HTML is still stripped.
        return self::embedVideos(MarkdownFormatting::restore(
            Str::markdown(MarkdownFormatting::protect($markdown), self::OPTIONS),
        ));
    }

    /**
     * A video inserted from the media library is written as an image -
     * `![description](…/walkthrough.mp4)` - so the Markdown stays portable and
     * its address passes the same unsafe-link filter as any image. Only the
     * rendered <img> of an .mp4 or .webm address becomes a player; raw HTML
     * was already stripped, and both attributes arrive escaped.
     */
    private static function embedVideos(string $html): string
    {
        return preg_replace_callback(
            '#<img src="([^"]+\.(?:mp4|webm)(?:\?[^"]*)?)" alt="([^"]*)"(?: title="[^"]*")? />#i',
            fn (array $match) => '<video controls preload="metadata" src="'.$match[1].'" aria-label="'.$match[2].'">'
                .'<a href="'.$match[1].'">'.$match[2].'</a></video>',
            $html,
        ) ?? $html;
    }

    public static function toPlainText(?string $markdown): string
    {
        return trim(html_entity_decode(strip_tags(self::toHtml($markdown)), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    public static function excerpt(?string $markdown, int $characters = 200): string
    {
        return Str::limit(preg_replace('/\s+/u', ' ', self::toPlainText($markdown)) ?? '', $characters);
    }

    /** Bangla and English mixed content: ~180 words per minute, minimum 1. */
    public static function readingMinutes(?string $markdown): int
    {
        $words = str_word_count(self::toPlainText($markdown), 0, 'অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ');

        return max(1, (int) ceil($words / 180));
    }

    /** @return array<int, array{level:int, text:string, id:string}> */
    public static function headings(?string $markdown): array
    {
        if (blank($markdown)) {
            return [];
        }

        preg_match_all('/^(#{2,4})\s+(.+)$/m', $markdown, $matches, PREG_SET_ORDER);

        return array_map(fn (array $match) => [
            'level' => strlen($match[1]),
            // A heading may carry formatting tags; the contents list wants its words.
            'text' => trim(strip_tags($match[2])),
            'id' => Str::slug(trim(strip_tags($match[2]))) ?: Str::random(6),
        ], $matches);
    }
}
