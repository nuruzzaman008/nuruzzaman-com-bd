<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    /*
     * Sign in with Google, for customers only.
     *
     * The redirect goes to the site's own origin, not the API's: the session
     * cookie has no domain set, so a session established at
     * api.nuruzzaman.com.bd would be invisible to nuruzzaman.com.bd. The site
     * rewrites /api/* to this API, so the callback arrives here either way and
     * the cookie is set where the browser will send it back from.
     *
     * Both keys absent means the routes 404 and the button is not drawn.
     */
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env(
            'GOOGLE_REDIRECT_URI',
            rtrim((string) env('FRONTEND_URL', 'https://nuruzzaman.com.bd'), '/')
                .'/api/v1/auth/google/callback',
        ),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
