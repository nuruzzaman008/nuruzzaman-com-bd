<?php

namespace Tests\Unit;

use App\Support\Markdown;
use PHPUnit\Framework\TestCase;

/** A video inserted into an article from the media library plays on the page - and nothing else sneaks in with it. */
class MarkdownVideoEmbedTest extends TestCase
{
    public function test_a_video_written_as_an_image_becomes_a_player(): void
    {
        $html = Markdown::toHtml('![Triplex walkthrough](https://api.nuruzzaman.com.bd/storage/uploads/2026/09/walk.mp4)');

        $this->assertStringContainsString(
            '<video controls preload="metadata" src="https://api.nuruzzaman.com.bd/storage/uploads/2026/09/walk.mp4" aria-label="Triplex walkthrough">',
            $html,
        );
        // Anything that cannot play it still offers the file.
        $this->assertStringContainsString('<a href="https://api.nuruzzaman.com.bd/storage/uploads/2026/09/walk.mp4">Triplex walkthrough</a></video>', $html);
        $this->assertStringNotContainsString('<img', $html);
    }

    public function test_a_webm_with_a_version_marker_plays_too_and_images_stay_images(): void
    {
        $this->assertStringContainsString('<video controls preload="metadata" src="/storage/clip.webm?v=17"', Markdown::toHtml('![Clip](/storage/clip.webm?v=17)'));

        $image = Markdown::toHtml('![Beam](https://x.test/beam.png)');
        $this->assertStringContainsString('<img src="https://x.test/beam.png" alt="Beam" />', $image);
        $this->assertStringNotContainsString('<video', $image);
    }

    public function test_nothing_unsafe_rides_along(): void
    {
        $unsafe = Markdown::toHtml('![x](javascript:alert(1)//.mp4)');
        $this->assertStringNotContainsString('javascript:', $unsafe);
        $this->assertStringNotContainsString('<video', $unsafe);

        $raw = Markdown::toHtml('<video src="a.mp4" onloadstart="alert(1)"></video>');
        $this->assertStringNotContainsString('onloadstart', $raw);
        $this->assertStringNotContainsString('<video', $raw);

        $quoted = Markdown::toHtml('![A "quoted" clip](/storage/clip.mp4)');
        $this->assertStringContainsString('aria-label="A &quot;quoted&quot; clip"', $quoted);
    }
}
