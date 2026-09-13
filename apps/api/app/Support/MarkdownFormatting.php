<?php

namespace App\Support;

/**
 * The formatting Markdown cannot express: underline, colour, size and font.
 *
 * Author input is Markdown with raw HTML stripped, so nothing typed can put
 * script, styles or event handlers into a page. That rule stays. What this
 * adds is a closed list of exceptions, recognised before parsing and rebuilt
 * after it:
 *
 *     <u>…</u>
 *     <span data-color="blue">…</span>     one of COLORS
 *     <span data-size="lg">…</span>        one of SIZES
 *     <span data-font="serif">…</span>     one of FONTS
 *
 * Only those exact shapes count. `<span style="…">`, an extra attribute, an
 * unknown token or any other tag is left as raw HTML, which the renderer
 * strips as before. The output never carries an author's attribute value: a
 * colour becomes one of our own class names, so the palette is the one the
 * site's contrast was checked against rather than whatever was typed.
 *
 * How: each allowed tag becomes an inert token of private-use characters the
 * Markdown parser treats as ordinary text, so emphasis and headings around it
 * still parse. After rendering, tokens in text are turned back into tags;
 * tokens inside a tag (an image's alt text) are dropped, because markup there
 * would break the tag; tokens inside code are shown as the literal tag the
 * author typed. Tags are balanced as they are rebuilt and closed at the end of
 * the block they began in, so an unclosed colour cannot run on down the page.
 */
final class MarkdownFormatting
{
    public const COLORS = ['blue', 'teal', 'green', 'red', 'orange', 'navy', 'gray'];

    public const SIZES = ['sm', 'lg', 'xl', '2xl'];

    public const FONTS = ['bangla', 'english', 'serif', 'mono'];

    private const OPEN = "\u{E000}";

    private const CLOSE = "\u{E001}";

    /** Block-level closing tags: formatting never runs past one of these. */
    private const BLOCK_END = '#^</(p|li|h[1-6]|td|th|blockquote|dt|dd|figcaption)>$#';

    /** Before parsing: allowed tags become tokens the parser leaves alone. */
    public static function protect(string $markdown): string
    {
        // A token pasted in by an author must never be mistaken for one of ours.
        $markdown = str_replace([self::OPEN, self::CLOSE], '', $markdown);

        $markdown = preg_replace_callback(
            '/<span\s+data-(color|size|font)\s*=\s*(["\'])([a-z0-9]+)\2\s*>/i',
            function (array $match): string {
                $kind = strtolower($match[1]);
                $value = strtolower($match[3]);

                return self::allowed($kind, $value)
                    ? self::token('o', $kind, $value)
                    : $match[0];
            },
            $markdown,
        ) ?? $markdown;

        return preg_replace(
            ['/<u\s*>/i', '/<\/u\s*>/i', '/<\/span\s*>/i'],
            [self::token('o', 'u'), self::token('c', 'u'), self::token('c', 'span')],
            $markdown,
        ) ?? $markdown;
    }

    /** After rendering: tokens become balanced tags, or nothing. */
    public static function restore(string $html): string
    {
        if (! str_contains($html, self::OPEN)) {
            return $html;
        }

        $parts = preg_split('/(<[^>]*>)/', $html, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];
        $stack = [];
        $inCode = 0;
        $out = '';

        foreach ($parts as $part) {
            if ($part[0] === '<') {
                // Inside a tag the token is attribute text; markup there would
                // break the tag, so it is simply dropped.
                $part = self::stripTokens($part);
                $lower = strtolower($part);

                if (preg_match('#^<(code|pre)\b#', $lower)) {
                    $inCode++;
                } elseif (preg_match('#^</(code|pre)>$#', $lower)) {
                    $inCode = max(0, $inCode - 1);
                } elseif (preg_match(self::BLOCK_END, $lower)) {
                    $out .= self::closeAll($stack);
                }

                $out .= $part;

                continue;
            }

            $out .= preg_replace_callback(
                '/\x{E000}([oc]):([a-z0-9]+)(?::([a-z0-9]+))?\x{E001}/u',
                function (array $match) use (&$stack, $inCode): string {
                    $direction = $match[1];
                    $kind = $match[2];
                    $value = $match[3] ?? '';

                    if ($inCode > 0) {
                        return self::literal($direction, $kind, $value);
                    }

                    if ($direction === 'o') {
                        if ($kind === 'u') {
                            $stack[] = 'u';

                            return '<u>';
                        }

                        if (self::allowed($kind, $value)) {
                            $stack[] = 'span';

                            return '<span class="nb-'.$kind.'-'.$value.'">';
                        }

                        return '';
                    }

                    $tag = $kind === 'u' ? 'u' : 'span';

                    // A close only counts when it closes the innermost open tag;
                    // anything else would produce overlapping markup.
                    if (end($stack) === $tag) {
                        array_pop($stack);

                        return '</'.$tag.'>';
                    }

                    return '';
                },
                $part,
            ) ?? '';
        }

        return self::stripTokens($out.self::closeAll($stack));
    }

    public static function allowed(string $kind, string $value): bool
    {
        return match ($kind) {
            'color' => in_array($value, self::COLORS, true),
            'size' => in_array($value, self::SIZES, true),
            'font' => in_array($value, self::FONTS, true),
            default => false,
        };
    }

    private static function token(string $direction, string $kind, string $value = ''): string
    {
        return self::OPEN.$direction.':'.$kind.($value !== '' ? ':'.$value : '').self::CLOSE;
    }

    private static function stripTokens(string $text): string
    {
        $text = preg_replace('/\x{E000}[^\x{E001}]*\x{E001}/u', '', $text) ?? $text;

        return str_replace([self::OPEN, self::CLOSE], '', $text);
    }

    /** The tag as the author typed it, escaped for display inside code. */
    private static function literal(string $direction, string $kind, string $value): string
    {
        $tag = match (true) {
            $direction === 'o' && $kind === 'u' => '<u>',
            $direction === 'o' => '<span data-'.$kind.'="'.$value.'">',
            $kind === 'u' => '</u>',
            default => '</span>',
        };

        return htmlspecialchars($tag, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /** @param  array<int, string>  $stack */
    private static function closeAll(array &$stack): string
    {
        $out = '';

        while ($stack !== []) {
            $out .= '</'.array_pop($stack).'>';
        }

        return $out;
    }
}
