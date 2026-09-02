<?php

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| In production the browser only ever sees one origin because Nginx routes
| /api and /sanctum to Laravel. CORS therefore only matters for local
| development, where Next.js runs on its own port.
|
*/

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(explode(',', (string) env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000',
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['X-Request-Id'],

    'max_age' => 0,

    'supports_credentials' => true,
];
