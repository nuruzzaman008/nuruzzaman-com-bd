<?php

/*
|--------------------------------------------------------------------------
| Private video delivery
|--------------------------------------------------------------------------
|
| Lessons store a provider name and a provider-side asset id only. A playable
| URL is minted per request, for an authorised enrolment, and expires quickly.
| The `none` driver returns an explicit "video not configured" state.
|
*/

return [
    'driver' => env('VIDEO_DRIVER', 'none'),

    'playback_ttl_seconds' => (int) env('VIDEO_PLAYBACK_TTL', 300),

    'bunny' => [
        'library_id' => env('BUNNY_STREAM_LIBRARY_ID'),
        'token_key' => env('BUNNY_STREAM_TOKEN_KEY'),
        'cdn_hostname' => env('BUNNY_STREAM_CDN_HOSTNAME'),
    ],

    'vimeo' => [
        'access_token' => env('VIMEO_ACCESS_TOKEN'),
    ],
];
