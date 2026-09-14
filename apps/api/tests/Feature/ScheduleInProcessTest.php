<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\Post;
use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

/**
 * The host has proc_open disabled, so nothing scheduled may need a child
 * process: a Schedule::command() event would fail on every run.
 */
class ScheduleInProcessTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<int, \Illuminate\Console\Scheduling\Event> */
    private function events(): array
    {
        // Loads routes/console.php, where the schedule is defined.
        $this->app->make(Kernel::class)->bootstrap();

        return $this->app->make(Schedule::class)->events();
    }

    public function test_nothing_scheduled_is_started_as_a_child_process(): void
    {
        $events = $this->events();

        $this->assertNotEmpty($events);

        foreach ($events as $event) {
            $this->assertInstanceOf(CallbackEvent::class, $event, 'Runs as a child process: '.($event->command ?? $event->description));
        }

        $names = array_map(fn ($event) => $event->description, $events);
        $this->assertContains('content:publish-due', $names);
        $this->assertContains('platform:housekeeping', $names);
    }

    public function test_the_scheduled_publisher_publishes_due_posts(): void
    {
        Bus::fake();

        Post::factory()->create(['status' => ContentStatus::Scheduled, 'scheduled_for' => now()->subMinute()]);
        Post::factory()->create(['status' => ContentStatus::Scheduled, 'scheduled_for' => now()->addDay()]);

        $publisher = collect($this->events())->first(fn ($event) => $event->description === 'content:publish-due');
        $publisher->run($this->app);

        $this->assertSame(1, Post::query()->where('status', ContentStatus::Published->value)->count());
    }
}
