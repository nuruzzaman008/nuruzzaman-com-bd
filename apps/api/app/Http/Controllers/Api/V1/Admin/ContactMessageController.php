<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\ContactReplyMail;
use App\Models\ContactMessage;
use App\Models\ContactMessageReply;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/**
 * Answering the contact form. The sender has no account here, so the answer
 * is emailed to the address they gave, and kept so the conversation reads
 * back in the dashboard.
 */
class ContactMessageController extends Controller
{
    public function reply(Request $request, ContactMessage $message): JsonResponse
    {
        abort_unless($request->user()->hasPermission('support.manage'), 403);

        $validated = $request->validate(['body' => ['required', 'string', 'min:2', 'max:5000']]);
        $staff = $request->user();

        $reply = DB::transaction(function () use ($message, $staff, $validated) {
            $reply = ContactMessageReply::query()->create([
                'contact_message_id' => $message->getKey(),
                'user_id' => $staff->getKey(),
                'body' => $validated['body'],
            ]);
            $message->forceFill(['handled_at' => $message->handled_at ?? now()])->save();
            Audit::record('contact.replied', $message, ['reply_id' => $reply->getKey()], $staff->getKey());

            return $reply;
        });

        // Queued after the commit, like every other email: a reply that did
        // not save is never sent.
        Mail::to($message->email)->queue((new ContactReplyMail($message, $reply, $staff->name))->afterCommit());

        return response()->json(['data' => ['id' => $reply->getKey(), 'handled_at' => $message->fresh()->handled_at?->toIso8601String()]], 201);
    }
}
