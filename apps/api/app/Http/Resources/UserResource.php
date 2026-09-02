<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
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
