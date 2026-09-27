<?php

return [
    // Server administrator allowlist, never controlled through the browser.
    'custom_base_urls' => array_values(array_filter(explode(',', env('GROWTH_AI_CUSTOM_BASE_URLS', '')))),
];
