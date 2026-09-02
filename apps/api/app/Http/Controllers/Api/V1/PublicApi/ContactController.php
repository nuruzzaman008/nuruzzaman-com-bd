<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'email' => ['required', 'email:rfc', 'max:191'],
            'subject' => ['required', 'string', 'min:3', 'max:255'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            // Honeypot: a real person leaves this empty.
            'website' => ['prohibited'],
        ]);

        $message = ContactMessage::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'ip_address' => $request->ip(),
        ]);

        Audit::record('contact.received', $message, ['email' => $validated['email']]);

        return response()->json(['message' => 'Thanks - your message has been received.'], 201);
    }
}
