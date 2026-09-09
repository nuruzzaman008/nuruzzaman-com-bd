<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AvatarController extends Controller
{
    public function store(Request $request): UserResource
    {
        $request->validate(['photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);
        $path = $request->file('photo')->store('profile-photos', 'private');
        try {
            $request->user()->profile()->updateOrCreate(['user_id' => $request->user()->id], ['avatar_path' => $path]);
        } catch (\Throwable $exception) {
            Storage::disk('private')->delete($path);
            throw $exception;
        }

        return new UserResource($request->user()->fresh()->load('profile', 'roles'));
    }

    public function own(Request $request): StreamedResponse
    {
        return $this->show($request->user());
    }

    public function show(User $user): StreamedResponse
    {
        $this->authorize('view', $user);
        $path = $user->profile?->avatar_path;
        abort_unless($path && Storage::disk('private')->exists($path), 404);

        return Storage::disk('private')->response($path, null, ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"]);
    }
}
