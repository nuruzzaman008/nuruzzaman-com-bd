<?php

namespace Tests\Unit;

use App\Support\Markdown;
use PHPUnit\Framework\TestCase;

/**
 * The classic-editor formatting beyond inline text: superscript, subscript,
 * strikethrough, alignment, indentation and list styles.
 */
class MarkdownBlockFormattingTest extends TestCase
{
    public function test_superscript_subscript_and_strikethrough_render(): void
    {
        $html = Markdown::toHtml('H<sub>2</sub>O, x<sup>2</sup> and ~~old~~');

        $this->assertStringContainsString('<sub>2</sub>', $html);
        $this->assertStringContainsString('<sup>2</sup>', $html);
        $this->assertStringContainsString('<del>old</del>', $html);
    }

    public function test_an_alignment_wrapper_formats_every_block_inside_it_and_nothing_after(): void
    {
        $html = Markdown::toHtml(
            "<div data-align=\"center\">\n\n## Title\n\nFirst paragraph\n\nSecond paragraph\n\n</div>\n\nAfter",
        );

        $this->assertStringContainsString('<h2 class="nb-align-center">Title</h2>', $html);
        $this->assertStringContainsString('<p class="nb-align-center">First paragraph</p>', $html);
        $this->assertStringContainsString('<p class="nb-align-center">Second paragraph</p>', $html);
        $this->assertStringContainsString('<p>After</p>', $html);
        $this->assertSame(3, substr_count($html, 'nb-align-center'));
        // The lines that held only the wrapper leave no empty paragraph behind.
        $this->assertDoesNotMatchRegularExpression('#<p[^>]*>\s*</p>#', $html);
    }

    public function test_a_wrapper_on_the_same_line_formats_that_paragraph(): void
    {
        $this->assertStringContainsString(
            '<p class="nb-align-right">Right aligned</p>',
            Markdown::toHtml('<div data-align="right">Right aligned</div>'),
        );
    }

    public function test_an_inner_wrapper_adds_to_the_outer_one_and_the_outer_resumes_after_it(): void
    {
        $html = Markdown::toHtml(
            "<div data-indent=\"1\">\n\nOuter\n\n<div data-align=\"center\">\n\nInner\n\n</div>\n\nOuter again\n\n</div>",
        );

        $this->assertStringContainsString('<p class="nb-indent-1">Outer</p>', $html);
        $this->assertStringContainsString('<p class="nb-align-center nb-indent-1">Inner</p>', $html);
        $this->assertStringContainsString('<p class="nb-indent-1">Outer again</p>', $html);
    }

    public function test_a_list_style_lands_on_the_list_and_keeps_its_attributes(): void
    {
        $this->assertStringContainsString(
            '<ol start="3" class="nb-list-lower-roman">',
            Markdown::toHtml("<div data-list=\"lower-roman\">\n\n3. three\n4. four\n\n</div>"),
        );

        $this->assertStringContainsString(
            '<ul class="nb-list-square">',
            Markdown::toHtml("<div data-list=\"square\">\n\n- a\n- b\n\n</div>"),
        );
    }

    public function test_an_indent_is_not_repeated_inside_the_quote_it_indents(): void
    {
        $html = Markdown::toHtml("<div data-indent=\"2\">\n\n> quoted\n\n</div>");

        $this->assertStringContainsString('<blockquote class="nb-indent-2">', $html);
        $this->assertStringContainsString('<p>quoted</p>', $html);
    }

    public function test_block_wrappers_outside_the_closed_list_get_nothing(): void
    {
        $html = Markdown::toHtml(
            "<div data-align=\"center\" onclick=\"alert(1)\">a</div>\n\n"
            ."<div style=\"text-align:center\">b</div>\n\n"
            ."<div data-align=\"middle\">c</div>\n\n"
            ."<div data-list=\"url(x)\">d</div>",
        );

        foreach (['nb-align', 'nb-list', 'onclick', 'style=', 'url('] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html, $forbidden);
        }
    }

    public function test_a_stray_closing_div_is_harmless(): void
    {
        $html = Markdown::toHtml("Text</div>\n\nMore");

        $this->assertStringContainsString('<p>Text</p>', $html);
        $this->assertStringContainsString('<p>More</p>', $html);
    }

    public function test_inside_code_a_block_wrapper_is_shown_as_typed(): void
    {
        $html = Markdown::toHtml("```\n<div data-align=\"center\">\n```");

        $this->assertStringNotContainsString('nb-align', $html);
        $this->assertStringContainsString('&lt;div data-align=&quot;center&quot;&gt;', $html);
    }

    public function test_an_unclosed_wrapper_formats_the_rest_without_breaking_the_page(): void
    {
        $html = Markdown::toHtml("<div data-align=\"justify\">\n\nA\n\nB");

        $this->assertStringContainsString('<p class="nb-align-justify">A</p>', $html);
        $this->assertStringContainsString('<p class="nb-align-justify">B</p>', $html);
    }
}
