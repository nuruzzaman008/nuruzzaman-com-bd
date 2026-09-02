<?php

/*
|--------------------------------------------------------------------------
| SSLCOMMERZ direct integration
|--------------------------------------------------------------------------
|
| Credentials are server-side only. They must never be given a NEXT_PUBLIC_
| prefix, committed, or sent to the browser. When no store id is configured the
| container binds the sandbox/fake gateway so the whole checkout flow still runs
| end to end in development and in tests.
|
*/

return [
    'driver' => env('SSLCOMMERZ_DRIVER', 'fake'),

    'mode' => env('SSLCOMMERZ_MODE', 'sandbox'),

    'sandbox' => [
        'store_id' => env('SSLCOMMERZ_SANDBOX_STORE_ID'),
        'store_password' => env('SSLCOMMERZ_SANDBOX_STORE_PASSWORD'),
        'session_url' => 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
        'validation_url' => 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
        'refund_url' => 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php',
    ],

    'live' => [
        'store_id' => env('SSLCOMMERZ_LIVE_STORE_ID'),
        'store_password' => env('SSLCOMMERZ_LIVE_STORE_PASSWORD'),
        'session_url' => 'https://securepay.sslcommerz.com/gwprocess/v4/api.php',
        'validation_url' => 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php',
        'refund_url' => 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php',
    ],

    'timeout_seconds' => (int) env('SSLCOMMERZ_TIMEOUT', 20),

    'urls' => [
        'success' => env('SSLCOMMERZ_SUCCESS_URL', '/checkout/result/success'),
        'fail' => env('SSLCOMMERZ_FAIL_URL', '/checkout/result/failed'),
        'cancel' => env('SSLCOMMERZ_CANCEL_URL', '/checkout/result/cancelled'),
        'ipn' => env('SSLCOMMERZ_IPN_URL', '/api/v1/payments/sslcommerz/ipn'),
    ],

    /*
    | Optional allowlist of SSLCOMMERZ IPN source addresses. Empty means "accept
    | any source but still validate every callback against the Order Validation
    | API" - the validation call, not the source address, authorises a payment.
    */
    'ipn_allowlist' => array_values(array_filter(explode(',', (string) env('SSLCOMMERZ_IPN_ALLOWLIST', '')))),
];
