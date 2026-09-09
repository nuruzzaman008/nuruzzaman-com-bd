<?php

return [
    'enabled' => (bool) env('NB_ONLINE_LICENSING', false),
    // A random 32-byte credential shared only with the private Windows signing worker.
    'worker_token' => env('NB_SIGNING_WORKER_TOKEN'),
    'license_skus' => array_filter(explode(',', (string) env('NB_ONLINE_LICENSE_SKUS', 'NBET-V6-SINGLE'))),
];
