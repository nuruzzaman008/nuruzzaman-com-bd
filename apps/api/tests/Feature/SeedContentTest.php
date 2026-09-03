<?php

namespace Tests\Feature;

use Database\Seeders\Support\ContentBundle;
use Tests\TestCase;

/**
 * Guards the seed-content parser.
 *
 * Every seed file opens with an explanatory comment for whoever edits it. That
 * comment used to make the first document of each file fail to parse, and the
 * parser dropped it without a word — so the first article, the first course and
 * the first lesson of every file silently never existed.
 */
class SeedContentTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: int}>
     */
    public static function bundles(): array
    {
        return [
            'articles' => ['seed-posts-bn.md', 6],
            'article library' => ['seed-posts-bn-library.md', 14],
            'pages' => ['seed-pages-bn.md', 15],
            'courses' => ['seed-courses-bn.md', 11],
            'lessons' => ['seed-lessons-bn.md', 43],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('bundles')]
    public function test_every_document_in_a_seed_file_is_parsed(string $file, int $expected): void
    {
        $documents = ContentBundle::load($file);

        $this->assertCount(
            $expected,
            $documents,
            "{$file} should yield {$expected} documents. A lower count means one was dropped.",
        );
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('bundles')]
    public function test_the_first_document_survives_the_leading_comment(string $file, int $expected): void
    {
        $documents = ContentBundle::load($file);
        $first = $documents[0];

        $this->assertCount($expected, $documents);

        $this->assertArrayHasKey('slug', $first['meta']);
        $this->assertNotSame('', trim($first['meta']['slug']));
        $this->assertStringNotContainsString('<!--', $first['body']);
    }

    public function test_a_malformed_document_throws_instead_of_being_skipped(): void
    {
        $path = base_path('../../content/seed-malformed-test.md');
        file_put_contents($path, "---\nslug: fine\n---\n\nBody.\n\n@@@\n\nno front matter here\n");

        try {
            $this->expectException(\RuntimeException::class);
            $this->expectExceptionMessageMatches('/Malformed document #1/');

            ContentBundle::load('seed-malformed-test.md');
        } finally {
            @unlink($path);
        }
    }
}
