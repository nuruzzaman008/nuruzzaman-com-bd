<?php

namespace App\Http\Resources;

use App\Models\User;
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
            'mfa_enabled' => $this->mfa_confirmed_at !== null,
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
