<?php

namespace Tests\Unit;

use App\Support\Markdown;
use App\Support\MarkdownFormatting;
use Illuminate\Support\Str;
use PHPUnit\Framework\TestCase;

/**
 * The rendering every article, page, product, course and lesson goes through.
 *
 * Two things are held here together: the formatting the editor toolbar
 * produces comes out as intended, and nothing beyond that closed list gets
 * through - no styles, no handlers, no script, no tag an author can shape.
 */
class MarkdownFormattingTest extends TestCase
{
    public function test_content_without_the_new_formatting_renders_exactly_as_before(): void
    {
        $markdown = "## Loads\n\nA **bold** and *italic* line with [a link](https://example.org).\n\n- one\n- two\n\n```\ncode\n```";

        $this->assertSame(
            Str::markdown($markdown, ['html_input' => 'strip', 'allow_unsafe_links' => false, 'max_nesting_level' => 32]),
            Markdown::toHtml($markdown),
        );
    }

    public function test_every_heading_level_renders(): void
    {
        $html = Markdown::toHtml("# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six");

        foreach (range(1, 6) as $level) {
            $this->assertStringContainsString("<h{$level}>", $html);
        }
    }

    public function test_bold_italic_and_underline_render(): void
    {
        $html = Markdown::toHtml('**bold** *italic* <u>under</u>');

        $this->assertStringContainsString('<strong>bold</strong>', $html);
        $this->assertStringContainsString('<em>italic</em>', $html);
        $this->assertStringContainsString('<u>under</u>', $html);
    }

    public function test_every_allowed_colour_size_and_font_becomes_our_own_class(): void
    {
        foreach (['color' => MarkdownFormatting::COLORS, 'size' => MarkdownFormatting::SIZES, 'font' => MarkdownFormatting::FONTS] as $kind => $tokens) {
            foreach ($tokens as $token) {
                $html = Markdown::toHtml("<span data-{$kind}=\"{$token}\">text</span>");

                $this->assertStringContainsString("<span class=\"nb-{$kind}-{$token}\">text</span>", $html, "{$kind}={$token}");
            }
        }
    }

    public function test_an_unknown_token_keeps_the_text_and_adds_nothing(): void
    {
        $html = Markdown::toHtml('<span data-color="hotpink">text</span> <span data-size="999px">more</span>');

        $this->assertStringNotContainsString('nb-', $html);
        $this->assertStringNotContainsString('<span', $html);
        $this->assertStringContainsString('text', $html);
        $this->assertStringContainsString('more', $html);
    }

    public function test_nothing_outside_the_closed_list_gets_through(): void
    {
        $html = Markdown::toHtml(
            '<span data-color="blue" onclick="alert(1)">a</span> '
            .'<span style="color:red">b</span> '
            .'<u onmouseover="alert(2)">c</u> '
            .'<script>alert(3)</script> '
            .'<img src=x onerror="alert(4)"> '
            .'<font color="red">d</font>',
        );

        foreach (['onclick', 'onmouseover', 'onerror', 'style=', '<script', '<img', '<font'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html, $forbidden);
        }
    }

    public function test_a_token_typed_in_by_hand_is_not_mistaken_for_ours(): void
    {
        $html = Markdown::toHtml("\u{E000}o:color:blue\u{E001}forged\u{E000}c:span\u{E001}");

        $this->assertStringNotContainsString('nb-color', $html);
        $this->assertStringNotContainsString("\u{E000}", $html);
        $this->assertStringNotContainsString("\u{E001}", $html);
        $this->assertStringContainsString('forged', $html);
    }

    public function test_an_unclosed_colour_stops_at_the_end_of_its_paragraph(): void
    {
        $html = Markdown::toHtml("<span data-color=\"red\">one\n\ntwo");

        $this->assertStringContainsString('<p><span class="nb-color-red">one</span></p>', $html);
        $this->assertStringContainsString('<p>two</p>', $html);
    }

    public function test_overlapping_tags_still_come_out_well_formed(): void
    {
        $html = Markdown::toHtml('<u><span data-color="blue">x</u></span> <span data-size="lg">y</span></span></u>');

        $this->assertSame(substr_count($html, '<span'), substr_count($html, '</span>'));
        $this->assertSame(substr_count($html, '<u>'), substr_count($html, '</u>'));
    }

    public function test_formatting_nests_inside_bold_and_headings(): void
    {
        $this->assertStringContainsString(
            '<strong><span class="nb-color-blue"><u>x</u></span></strong>',
            Markdown::toHtml('**<span data-color="blue"><u>x</u></span>**'),
        );

        $this->assertStringContainsString(
            '<h2><span class="nb-size-xl">Loads</span></h2>',
            Markdown::toHtml('## <span data-size="xl">Loads</span>'),
        );
    }

    public function test_inside_code_the_tag_is_shown_as_typed(): void
    {
        $html = Markdown::toHtml("Use `<u>` here.\n\n```\n<span data-color=\"blue\">x</span>\n```");

        $this->assertStringNotContainsString('nb-color', $html);
        $this->assertStringNotContainsString('<u>', $html);
        $this->assertStringContainsString('&lt;u&gt;', $html);
        $this->assertStringContainsString('&lt;span data-color=&quot;blue&quot;&gt;', $html);
    }

    public function test_a_token_in_an_attribute_is_dropped_rather_than_breaking_the_tag(): void
    {
        $html = Markdown::toHtml('![<u>alt</u>](https://example.org/a.png)');

        $this->assertMatchesRegularExpression('/<img src="https:\/\/example\.org\/a\.png" alt="alt"/', $html);
        $this->assertStringNotContainsString('<u>', $html);
    }

    public function test_the_table_of_contents_and_plain_text_carry_no_markup(): void
    {
        $headings = Markdown::headings('## <span data-color="blue">Loads</span> and <u>paths</u>');

        $this->assertSame('Loads and paths', $headings[0]['text']);
        $this->assertSame('loads-and-paths', $headings[0]['id']);

        $this->assertSame('Big text', Markdown::toPlainText('<span data-size="xl">Big</span> text'));
    }
}
