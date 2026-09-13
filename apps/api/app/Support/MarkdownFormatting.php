<?php

namespace App\Support;

/**
 * The formatting Markdown cannot express, as a closed list of our own tags.
 *
 * Author input is Markdown with raw HTML stripped, so nothing typed can put
 * script, styles or event handlers into a page. That rule stays. What this
 * adds is a fixed set of exceptions, recognised before parsing and rebuilt
 * after it:
 *
 *   inline   <u> <sup> <sub>
 *            <span data-color|size|font="token">
 *   block    <div data-align|indent|list="token"> … </div>
 *
 * Only those exact shapes count. A style attribute, an extra attribute, an
 * unknown token or any other tag is left as raw HTML, which the renderer
 * strips as before. The output never carries an author's attribute value: a
 * token becomes one of our own class names.
 *
 * How: each allowed tag becomes an inert token of private-use characters the
 * Markdown parser treats as ordinary text, so emphasis, headings and lists
 * around it still parse. After rendering:
 *
 *  - an inline token in text becomes its tag, balanced, and closed at the end
 *    of the block it began in, so an unclosed colour cannot run on;
 *  - a block token opens a wrapper whose classes go on every paragraph,
 *    heading, list or quote rendered until its </div> - including the block
 *    it appears at the start of, when written on the same line as the text;
 *  - a token inside a tag (an image's alt text) is dropped, because markup
 *    there would break the tag, and a token inside code is shown as the
 *    literal tag the author typed;
 *  - a paragraph left holding nothing but tokens is removed.
 */
final class MarkdownFormatting
{
    public const COLORS = ['blue', 'teal', 'green', 'red', 'orange', 'navy', 'gray'];

    public const SIZES = ['sm', 'lg', 'xl', '2xl'];

    public const FONTS = ['bangla', 'english', 'serif', 'mono'];

    public const ALIGNS = ['center', 'right', 'justify'];

    public const INDENTS = ['1', '2', '3'];

    public const LIST_STYLES = [
        'disc', 'circle', 'square',
        'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman',
    ];

    private const INLINE_TAGS = ['u', 'sup', 'sub'];

    private const OPEN = "\u{E000}";

    private const CLOSE = "\u{E001}";

    /** Block-level closing tags: inline formatting never runs past one. */
    private const BLOCK_END = '#^</(p|li|h[1-6]|td|th|blockquote|dt|dd|figcaption)>$#';

    /** Block-level opening tags a wrapper's classes can land on. */
    private const BLOCK_OPEN = '#^<(p|h[1-6]|li|blockquote|ul|ol|td|th)(?:\s[^>]*)?>$#';

    private const ALIGNABLE = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'td', 'th'];

    private const INDENTABLE = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol'];

    /** Blocks whose contents would inherit an indent, so it is not repeated inside. */
    private const CONTAINERS = ['ul', 'ol', 'blockquote'];

    /** Before parsing: allowed tags become tokens the parser leaves alone. */
    public static function protect(string $markdown): string
    {
        // A token pasted in by an author must never be mistaken for one of ours.
        $markdown = str_replace([self::OPEN, self::CLOSE], '', $markdown);

        $markdown = preg_replace_callback(
            '/<span\s+data-(color|size|font)\s*=\s*(["\'])([a-z0-9]+)\2\s*>/i',
            fn (array $match): string => self::tokenIfAllowed($match),
            $markdown,
        ) ?? $markdown;

        $markdown = preg_replace_callback(
            '/<div\s+data-(align|indent|list)\s*=\s*(["\'])([a-z0-9-]+)\2\s*>/i',
            fn (array $match): string => self::tokenIfAllowed($match),
            $markdown,
        ) ?? $markdown;

        $markdown = preg_replace_callback(
            '/<(\/?)(u|sup|sub)\s*>/i',
            fn (array $match): string => self::token($match[1] === '/' ? 'c' : 'o', strtolower($match[2])),
            $markdown,
        ) ?? $markdown;

        return preg_replace(
            ['/<\/span\s*>/i', '/<\/div\s*>/i'],
            [self::token('c', 'span'), self::token('c', 'div')],
            $markdown,
        ) ?? $markdown;
    }

    /** After rendering: tokens become balanced tags and block classes, or nothing. */
    public static function restore(string $html): string
    {
        if (! str_contains($html, self::OPEN)) {
            return $html;
        }

        $parts = preg_split('/(<[^>]*>)/', $html, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];

        $state = [
            'out' => '',
            // Open inline tags, innermost last.
            'inline' => [],
            // Open block wrappers as [kind, value], innermost last.
            'blocks' => [],
            'code' => 0,
            // How many lists or quotes the output is currently inside.
            'depth' => 0,
            // The block most recently opened: where its tag sits in `out`, and
            // whether any content has followed it yet.
            'current' => null,
        ];

        foreach ($parts as $part) {
            if ($part[0] === '<') {
                self::tag(self::stripTokens($part), $state);
            } else {
                self::text($part, $state);
            }
        }

        $out = $state['out'].self::closeInline($state['inline']);

        // A wrapper written on lines of its own leaves a paragraph holding only
        // its token; that paragraph has no business on the page.
        $out = preg_replace('#<p(?: class="[^"]*")?>\s*</p>\n?#', '', $out) ?? $out;

        return self::stripTokens($out);
    }

    public static function allowed(string $kind, string $value): bool
    {
        return match ($kind) {
            'color' => in_array($value, self::COLORS, true),
            'size' => in_array($value, self::SIZES, true),
            'font' => in_array($value, self::FONTS, true),
            'align' => in_array($value, self::ALIGNS, true),
            'indent' => in_array($value, self::INDENTS, true),
            'list' => in_array($value, self::LIST_STYLES, true),
            default => false,
        };
    }

    /** @param  array<string, mixed>  $state */
    private static function tag(string $part, array &$state): void
    {
        $lower = strtolower($part);

        if (preg_match('#^<(code|pre)\b#', $lower)) {
            $state['code']++;
        } elseif (preg_match('#^</(code|pre)>$#', $lower)) {
            $state['code'] = max(0, $state['code'] - 1);
        }

        if (preg_match(self::BLOCK_END, $lower)) {
            $state['out'] .= self::closeInline($state['inline']);
            $state['current'] = null;
        }

        if (preg_match('#^</(ul|ol|blockquote)>$#', $lower)) {
            $state['depth'] = max(0, $state['depth'] - 1);
        }

        if (preg_match(self::BLOCK_OPEN, $lower, $match)) {
            $name = $match[1];
            $tag = self::withClasses($part, self::classesFor($name, $state['blocks'], $state['depth']));

            $state['current'] = [
                'start' => strlen($state['out']),
                'length' => strlen($tag),
                'raw' => $part,
                'name' => $name,
                'fresh' => true,
            ];
            $state['out'] .= $tag;

            if (in_array($name, self::CONTAINERS, true)) {
                $state['depth']++;
            }

            return;
        }

        // Any other tag inside a block - an image, a link - is content, so a
        // wrapper token after it no longer sits at the start of the block.
        if ($state['current'] !== null) {
            $state['current']['fresh'] = false;
        }

        $state['out'] .= $part;
    }

    /** @param  array<string, mixed>  $state */
    private static function text(string $part, array &$state): void
    {
        $pieces = preg_split('/(\x{E000}[^\x{E001}]*\x{E001})/u', $part, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];

        foreach ($pieces as $piece) {
            if (! str_starts_with($piece, self::OPEN)) {
                $state['out'] .= $piece;

                if ($state['current'] !== null && trim($piece) !== '') {
                    $state['current']['fresh'] = false;
                }

                continue;
            }

            if (! preg_match('/^\x{E000}([oc]):([a-z0-9]+)(?::([a-z0-9-]+))?\x{E001}$/u', $piece, $match)) {
                continue;
            }

            $direction = $match[1];
            $kind = $match[2];
            $value = $match[3] ?? '';

            $state['out'] .= $state['code'] > 0
                ? self::literal($direction, $kind, $value)
                : self::apply($direction, $kind, $value, $state);
        }
    }

    /** @param  array<string, mixed>  $state */
    private static function apply(string $direction, string $kind, string $value, array &$state): string
    {
        if ($direction === 'o') {
            if (in_array($kind, self::INLINE_TAGS, true)) {
                $state['inline'][] = $kind;

                return '<'.$kind.'>';
            }

            if (in_array($kind, ['color', 'size', 'font'], true) && self::allowed($kind, $value)) {
                $state['inline'][] = 'span';

                return '<span class="nb-'.$kind.'-'.$value.'">';
            }

            if (in_array($kind, ['align', 'indent', 'list'], true) && self::allowed($kind, $value)) {
                $state['blocks'][] = [$kind, $value];
                self::reclassCurrent($state);
            }

            return '';
        }

        if ($kind === 'div') {
            array_pop($state['blocks']);

            return '';
        }

        // A close only counts when it closes the innermost open tag; anything
        // else would produce overlapping markup.
        if (in_array($kind, [...self::INLINE_TAGS, 'span'], true) && end($state['inline']) === $kind) {
            array_pop($state['inline']);

            return '</'.$kind.'>';
        }

        return '';
    }

    /**
     * A wrapper written on the same line as its text arrives just inside the
     * block it should format, so that block's tag is rewritten in place.
     *
     * @param  array<string, mixed>  $state
     */
    private static function reclassCurrent(array &$state): void
    {
        $current = $state['current'];

        if ($current === null || ! $current['fresh']) {
            return;
        }

        $depth = in_array($current['name'], self::CONTAINERS, true)
            ? max(0, $state['depth'] - 1)
            : $state['depth'];

        $tag = self::withClasses($current['raw'], self::classesFor($current['name'], $state['blocks'], $depth));

        $state['out'] = substr_replace($state['out'], $tag, $current['start'], $current['length']);
        $state['current']['length'] = strlen($tag);
    }

    /**
     * @param  array<int, array{0: string, 1: string}>  $blocks
     * @return array<int, string>
     */
    private static function classesFor(string $name, array $blocks, int $depth): array
    {
        $active = [];

        foreach ($blocks as [$kind, $value]) {
            $active[$kind] = $value;
        }

        $classes = [];

        if (isset($active['align']) && in_array($name, self::ALIGNABLE, true)) {
            $classes[] = 'nb-align-'.$active['align'];
        }

        // Only at the outermost level: a paragraph inside an indented list or
        // quote is already indented by it.
        if (isset($active['indent']) && $depth === 0 && in_array($name, self::INDENTABLE, true)) {
            $classes[] = 'nb-indent-'.$active['indent'];
        }

        if (isset($active['list']) && in_array($name, ['ul', 'ol'], true)) {
            $classes[] = 'nb-list-'.$active['list'];
        }

        return $classes;
    }

    /** @param  array<int, string>  $classes */
    private static function withClasses(string $tag, array $classes): string
    {
        if ($classes === []) {
            return $tag;
        }

        return preg_replace('/\s*>$/', ' class="'.implode(' ', $classes).'">', $tag, 1) ?? $tag;
    }

    /** @param  array<int, string>  $match */
    private static function tokenIfAllowed(array $match): string
    {
        $kind = strtolower($match[1]);
        $value = strtolower($match[3]);

        return self::allowed($kind, $value) ? self::token('o', $kind, $value) : $match[0];
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
            $direction === 'o' && in_array($kind, self::INLINE_TAGS, true) => '<'.$kind.'>',
            $direction === 'o' && in_array($kind, ['align', 'indent', 'list'], true) => '<div data-'.$kind.'="'.$value.'">',
            $direction === 'o' => '<span data-'.$kind.'="'.$value.'">',
            default => '</'.$kind.'>',
        };

        return htmlspecialchars($tag, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /** @param  array<int, string>  $stack */
    private static function closeInline(array &$stack): string
    {
        $out = '';

        while ($stack !== []) {
            $out .= '</'.array_pop($stack).'>';
        }

        return $out;
    }
}
