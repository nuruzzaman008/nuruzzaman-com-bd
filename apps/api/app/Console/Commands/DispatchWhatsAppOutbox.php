<?php

namespace App\Console\Commands;

use App\Services\WhatsApp\WhatsAppMessaging;
use App\Services\WhatsApp\WhatsAppOrderConfirmation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DispatchWhatsAppOutbox extends Command
{
    protected $signature = 'whatsapp:dispatch {--max=5 : Maximum queued messages to attempt}';

    protected $description = 'Dispatch reserved WhatsApp outbox entries once, without automatic retries';

    public function handle(WhatsAppMessaging $wa): int
    {
        $max = max(1, min(50, (int) $this->option('max')));
        app(WhatsAppOrderConfirmation::class)->process($max);
        $ids = DB::table('wa_messages')->where('status', 'queued')->orderBy('id')->limit($max)->pluck('id');
        foreach ($ids as $id) {
            $wa->dispatch($id);
        }
        $this->info('Processed '.$ids->count().' reserved entries.');

        return self::SUCCESS;
    }
}
