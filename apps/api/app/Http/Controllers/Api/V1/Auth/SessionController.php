<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Who is signed in, if anyone - for the site header and footer.
 *
 * They used to ask /me, which rightly answers a signed-out visitor with 401.
 * A browser prints every 401 as a red error in the console, so each page view
 * by a visitor logged one, although nothing had gone wrong. This answers 200
 * either way. It grants nothing: every read and write is still authorised by
 * the endpoint that serves it, and /me keeps its 401 for everything else.
 */
class SessionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        // An inactive account is refused by /me as well, so the site shows it
        // as signed out rather than as a session that cannot do anything.
        if (! $user instanceof User || ! $user->isActive()) {
            return response()->json(['data' => null])->header('Cache-Control', 'no-store');
        }

        return (new UserResource($user->load('profile', 'roles')))
            ->response()
            ->header('Cache-Control', 'no-store');
    }
}
