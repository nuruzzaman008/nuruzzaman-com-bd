<?php

/*
|--------------------------------------------------------------------------
| Project configuration
|--------------------------------------------------------------------------
|
| Owner-supplied values live in the environment, not in code. Every key that
| is still unset renders an honest "unavailable" state in the UI instead of a
| fabricated default. See docs/CONFIGURATION_CHECKLIST_BN.md.
|
*/

return [
    'site' => [
        'name' => env('NB_SITE_NAME', 'Engr. Md. Nuruzzaman, RSE'),
        'url' => env('NB_SITE_URL', 'https://nuruzzaman.com.bd'),
        'locale' => 'bn_BD',
        'timezone' => 'Asia/Dhaka',
        'currency' => 'BDT',
        'support_email' => env('NB_SUPPORT_EMAIL'),
        'support_hours' => env('NB_SUPPORT_HOURS'),
        'phone' => env('NB_PHONE'),
        'business_address' => env('NB_BUSINESS_ADDRESS'),
        'legal_entity' => env('NB_LEGAL_ENTITY'),
    ],

    'seed' => [
        // The owner's staff account, created by AdminUserSeeder.
        'owner_email' => env('NB_ADMIN_EMAIL', 'admin@nuruzzaman.com.bd'),
        'owner_name' => env('NB_ADMIN_NAME', 'Engr. Md. Nuruzzaman'),
        // Deliberately has no default. Outside local/testing the seeder refuses
        // to create the account without it, so no build can ever ship carrying
        // a password that is written down in this repository.
        'owner_password' => env('NB_ADMIN_PASSWORD'),
    ],

    'legal' => [
        // Until this is true every legal page renders a visible DRAFT notice.
        'reviewed' => env('NB_LEGAL_REVIEWED', false),
        'reviewer' => env('NB_LEGAL_REVIEWER'),
    ],

    'product' => [
        // Free text, e.g. "AutoCAD 2024, 2025" - only what the owner has tested.
        'tested_autocad_versions' => env('NB_TESTED_AUTOCAD_VERSIONS'),
        // Which releases the build targets. This briefly read "AutoCAD 2024",
        // because the product PDF says so and the wider range had only ever been
        // inferred from a build folder's name, which is not evidence. The owner
        // confirmed the range directly on 3 September 2026, so it is now their
        // attestation rather than a guess.
        //
        // This is the design target, not a test result. `tested_autocad_versions`
        // above stays empty until each release is actually runtime-tested.
        'designed_for' => env('NB_DESIGNED_FOR', 'AutoCAD 2024-2027'),
        'installer_sha256' => env('NB_INSTALLER_SHA256'),
        'code_signing_status' => env('NB_CODE_SIGNING_STATUS', 'unknown'),
    ],

    'commerce' => [
        // Integer percent applied to the order subtotal; null means "not configured".
        'tax_percent' => env('NB_TAX_PERCENT') === null ? null : (int) env('NB_TAX_PERCENT'),
        'tax_note' => env('NB_TAX_NOTE'),
        'refund_policy_summary' => env('NB_REFUND_POLICY_SUMMARY'),
        // manual_hold | auto_release - what to do with a gateway "risk" flag.
        'risk_order_policy' => env('NB_RISK_ORDER_POLICY', 'manual_hold'),
        'cart_lifetime_days' => (int) env('NB_CART_LIFETIME_DAYS', 30),
    ],

    'downloads' => [
        'disk' => env('NB_PRIVATE_DISK', 'private'),
        'signed_url_ttl_minutes' => (int) env('NB_DOWNLOAD_URL_TTL', 10),
        'default_max_downloads' => (int) env('NB_DOWNLOAD_MAX', 10),
        'default_valid_days' => (int) env('NB_DOWNLOAD_VALID_DAYS', 365),
    ],

    'lms' => [
        'default_access_days' => env('NB_COURSE_ACCESS_DAYS') === null
            ? null
            : (int) env('NB_COURSE_ACCESS_DAYS'),
        'completion_threshold' => (int) env('NB_COURSE_COMPLETION_THRESHOLD', 100),
    ],

    'revalidation' => [
        // Signed webhook that asks Next.js to drop cached tags after a publish.
        'endpoint' => env('NEXT_REVALIDATE_URL'),
        'secret' => env('NEXT_REVALIDATE_SECRET'),
    ],

    'analytics' => [
        'ga4_id' => env('NB_GA4_ID'),
        'search_console_verification' => env('NB_SEARCH_CONSOLE_VERIFICATION'),
    ],
];
