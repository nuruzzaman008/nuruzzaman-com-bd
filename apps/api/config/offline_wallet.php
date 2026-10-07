<?php

return [
    // Routes fail closed unless explicitly enabled in an isolated/reviewed environment.
    'enabled' => (bool) env('NB_OFFLINE_WALLET_ENABLED', false),
    'signing_key_path' => env('NB_OFFLINE_WALLET_SIGNING_KEY_PATH'),
    'signing_key_id' => env('NB_OFFLINE_WALLET_SIGNING_KEY_ID', ''),
    'first_online_activation_required' => true,
    'policy_version' => (int) env('NB_OFFLINE_WALLET_POLICY_VERSION', 1),
    'max_allowance' => (int) env('NB_OFFLINE_WALLET_MAX_ALLOWANCE', 100),
    'lease_seconds' => (int) env('NB_OFFLINE_WALLET_LEASE_SECONDS', 86400),
    'sync_interval_seconds' => (int) env('NB_OFFLINE_WALLET_SYNC_SECONDS', 21600),
    'max_batch_size' => (int) env('NB_OFFLINE_WALLET_MAX_BATCH', 100),
];
