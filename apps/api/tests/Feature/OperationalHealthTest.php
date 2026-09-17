<?php

namespace Tests\Feature;

use App\Jobs\RecordQueueHeartbeat;
use App\Support\OperationalHealth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class OperationalHealthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // With debug on, the health route rethrows instead of answering.
        config(['app.debug' => false]);
    }

    public function test_up_is_up_when_the_scheduler_and_queue_have_run_recently(): void
    {
        OperationalHealth::beat(OperationalHealth::SCHEDULER_KEY);
        (new RecordQueueHeartbeat)->handle();

        $this->getJson('/up')->assertOk()->assertJsonPath('status', 'up');
    }

    public function test_up_is_up_before_the_first_heartbeat_after_a_cache_clear(): void
    {
        $this->getJson('/up')->assertOk();
    }

    public function test_up_is_down_when_the_scheduler_stopped(): void
    {
        Cache::put(OperationalHealth::SCHEDULER_KEY, now()->subMinutes(20)->getTimestamp());
        OperationalHealth::beat(OperationalHealth::QUEUE_KEY);

        $this->getJson('/up')->assertStatus(500)->assertJsonPath('status', 'down');
        $this->assertSame(['scheduler has not run for more than 15 minutes'], OperationalHealth::problems());
    }

    public function test_up_is_down_when_no_worker_takes_jobs(): void
    {
        OperationalHealth::beat(OperationalHealth::SCHEDULER_KEY);
        Cache::put(OperationalHealth::QUEUE_KEY, now()->subHour()->getTimestamp());

        $this->getJson('/up')->assertStatus(500);
    }
}
