<?php

namespace Tests\Unit;

use App\Support\LessonVideoUrl;
use PHPUnit\Framework\TestCase;

/** Facebook video links, beside the YouTube and Vimeo ones already covered. */
class LessonVideoUrlTest extends TestCase
{
    public function test_a_facebook_video_plays_in_facebooks_own_player(): void
    {
        $descriptor = LessonVideoUrl::descriptor('https://www.facebook.com/watch/?v=1234567890');

        $this->assertSame('facebook', $descriptor['provider']);
        $this->assertSame('iframe', $descriptor['kind']);
        $this->assertSame(
            'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D1234567890&show_text=false&width=1280',
            $descriptor['url'],
        );
    }

    public function test_every_common_shape_of_facebook_video_link_is_recognised(): void
    {
        $canonical = [
            'https://www.facebook.com/NBConsultant/videos/987654321/' => 'https://www.facebook.com/NBConsultant/videos/987654321/',
            'https://m.facebook.com/NBConsultant/videos/beam-design/987654321' => 'https://www.facebook.com/NBConsultant/videos/beam-design/987654321/',
            'https://web.facebook.com/reel/555666777' => 'https://www.facebook.com/reel/555666777/',
            'https://www.facebook.com/share/v/1AbCdEf/' => 'https://www.facebook.com/share/v/1AbCdEf/',
            'https://facebook.com/video.php?v=42' => 'https://www.facebook.com/watch/?v=42',
            'https://fb.watch/aBc_12-3/' => 'https://fb.watch/aBc_12-3/',
        ];

        foreach ($canonical as $link => $href) {
            $descriptor = LessonVideoUrl::descriptor($link);

            $this->assertNotNull($descriptor, $link);
            $this->assertSame('facebook', $descriptor['provider'], $link);

            parse_str((string) parse_url($descriptor['url'], PHP_URL_QUERY), $query);
            $this->assertSame($href, $query['href'], $link);
        }
    }

    public function test_a_facebook_link_that_is_not_a_video_is_refused(): void
    {
        foreach ([
            'https://www.facebook.com/NBConsultant',
            'https://www.facebook.com/profile.php?id=1',
            'https://www.facebook.com/watch/?v=not-a-number',
            'http://www.facebook.com/watch/?v=1',
        ] as $link) {
            $this->assertNull(LessonVideoUrl::descriptor($link), $link);
        }

        // A look-alike host is just another website, never Facebook's player.
        $this->assertSame('external', LessonVideoUrl::descriptor('https://evilfacebook.com/watch/?v=1')['provider']);
    }
}
