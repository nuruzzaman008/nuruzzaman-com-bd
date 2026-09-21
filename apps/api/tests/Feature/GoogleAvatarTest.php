<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The Google account's photo becomes the profile photo at Google sign-in,
 * when the account has none of its own.
 */
class GoogleAvatarTest extends TestCase
{
    use RefreshDatabase;

    /** A 1x1 PNG. */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private const PICTURE = 'https://lh3.googleusercontent.com/a/abc123=s96-c';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
        config([
            'services.google.client_id' => 'test-client',
            'services.google.client_secret' => 'test-secret',
        ]);
    }

    /** Google's token and userinfo replies, and whatever the picture address returns. */
    private function fakeGoogle(string $email, ?string $picture, mixed $pictureResponse = null): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'test-access-token']),
            'www.googleapis.com/oauth2/v3/userinfo' => Http::response([
                'sub' => 'google-'.md5($email),
                'email' => $email,
                'email_verified' => true,
                'name' => 'Rahim Uddin',
                'picture' => $picture,
            ]),
            '*' => $pictureResponse ?? Http::response(base64_decode(self::PNG), 200, ['Content-Type' => 'image/png']),
        ]);
    }

    private function googleCallback(): TestResponse
    {
        return $this->withSession(['google_oauth_state' => 'test-state'])
            ->get('/api/v1/auth/google/callback?state=test-state&code=test-code');
    }

    private function avatarOf(string $email): ?string
    {
        return User::query()->where('email', $email)->first()?->profile()->value('avatar_path');
    }

    public function test_a_new_google_account_gets_its_photo(): void
    {
        $this->fakeGoogle('new@example.com', self::PICTURE);

        $this->googleCallback()->assertRedirectContains('/account');

        $path = $this->avatarOf('new@example.com');
        $this->assertNotNull($path);
        $this->assertStringStartsWith('profile-photos/', $path);
        $this->assertStringEndsWith('.png', $path);
        Storage::disk('private')->assertExists($path);

        // Asked for the larger size, not Google's 96px default.
        Http::assertSent(fn ($request) => $request->url() === 'https://lh3.googleusercontent.com/a/abc123=s256-c');

        // The site shows it the same way as an uploaded one.
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.profile.has_photo', true);
        $this->get('/api/v1/me/avatar')->assertOk();
    }

    public function test_an_existing_account_without_a_photo_gets_it_on_the_next_google_sign_in(): void
    {
        $student = $this->customer(['email' => 'old@example.com']);
        $this->fakeGoogle($student->email, self::PICTURE);

        $this->googleCallback()->assertRedirectContains('/account');

        $this->assertNotNull($this->avatarOf($student->email));
    }

    public function test_a_photo_the_person_uploaded_is_never_replaced(): void
    {
        $student = $this->customer(['email' => 'mine@example.com']);
        $student->profile()->updateOrCreate(['user_id' => $student->getKey()], ['avatar_path' => 'profile-photos/mine.jpg']);
        $this->fakeGoogle($student->email, self::PICTURE);

        $this->googleCallback()->assertRedirectContains('/account');

        $this->assertSame('profile-photos/mine.jpg', $this->avatarOf($student->email));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'googleusercontent.com'));
    }

    public function test_only_googles_image_servers_are_fetched(): void
    {
        foreach ([
            'http://lh3.googleusercontent.com/a/abc',        // not https
            'https://evil.example.com/a.png',                 // someone else's host
            'https://googleusercontent.com.evil.example/a',   // lookalike
            'https://169.254.169.254/latest/meta-data',       // an internal address
        ] as $i => $picture) {
            $email = "host{$i}@example.com";
            $this->fakeGoogle($email, $picture);

            $this->googleCallback()->assertRedirectContains('/account');

            $this->assertNull($this->avatarOf($email), $picture);
            Http::assertNotSent(fn ($request) => $request->url() === $picture);
            $this->app['auth']->forgetGuards();
        }
    }

    public function test_anything_but_a_real_image_is_ignored(): void
    {
        $this->fakeGoogle('html@example.com', self::PICTURE, Http::response('<html>not a photo</html>', 200, ['Content-Type' => 'image/png']));

        $this->googleCallback()->assertRedirectContains('/account');

        $this->assertNull($this->avatarOf('html@example.com'));
    }

    public function test_the_sign_in_still_works_when_the_photo_cannot_be_fetched(): void
    {
        $this->fakeGoogle('down@example.com', self::PICTURE, fn () => throw new ConnectionException('timed out'));

        $this->googleCallback()->assertRedirectContains('/account');

        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.email', 'down@example.com');
        $this->assertNull($this->avatarOf('down@example.com'));
    }

    public function test_an_account_with_no_google_photo_signs_in_as_before(): void
    {
        $this->fakeGoogle('nopic@example.com', null);

        $this->googleCallback()->assertRedirectContains('/account');

        $this->assertNull($this->avatarOf('nopic@example.com'));
    }
}
