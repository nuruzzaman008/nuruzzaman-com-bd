<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\MfaSession;
use App\Support\TwoFactor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'account_mode' => $this->account_mode ?? 'ecommerce',
            'email' => $this->email,
            'phone' => $this->phone,
            'locale' => $this->locale,
            'timezone' => $this->timezone,
            'status' => $this->status,
            'email_verified' => $this->email_verified_at !== null,
            // When the account was created, for the dashboard's user list.
            'created_at' => $this->created_at?->toIso8601String(),
            'mfa_enabled' => $this->mfa_confirmed_at !== null,
            // Whether this session has typed a code. The dashboard asks for one
            // when it has not, rather than letting every admin page fail.
            'mfa_session_verified' => $this->mfa_confirmed_at !== null && MfaSession::isVerified($request, $this->resource),
            // Only on the account's own record: nobody else needs to know how
            // many ways back in someone has left.
            'mfa_recovery_codes_remaining' => $this->when(
                $this->mfa_confirmed_at !== null && $request->user()?->is($this->resource),
                fn () => TwoFactor::remainingRecoveryCodes($this->resource),
            ),
            'roles' => $this->roleNames()->values(),
            'permissions' => $this->when(
                $this->isStaff(),
                fn () => $this->permissionNames()->values(),
            ),
            'profile' => $this->whenLoaded('profile', fn () => [
                'has_photo' => filled($this->profile?->avatar_path),
                'display_name' => $this->profile?->display_name,
                'headline' => $this->profile?->headline,
                'bio' => $this->profile?->bio,
                'organization' => $this->profile?->organization,
                'designation' => $this->profile?->designation,
                'district' => $this->profile?->district,
                'links' => $this->profile?->links ?? [],
            ]),
        ];
    }
}
