<?php

/*
|--------------------------------------------------------------------------
| Trusted proxies
|--------------------------------------------------------------------------
|
| Which addresses may tell Laravel who the real client is through
| X-Forwarded-For. Read by the TrustProxies middleware on every request.
|
| Only real proxies belong here. On this host that is the server itself:
| Next.js calls the API from its own address, carrying the visitor's address
| in X-Forwarded-For. A browser talking to api.nuruzzaman.com.bd directly is
| the client, and anything it writes in that header is its own claim.
|
| Trusting every address ('*') made $request->ip() whatever a visitor chose to
| send, which switched off every per-address rate limit - login, contact form,
| search, referrals - and let the audit log record a forged address.
|
| Production sets TRUSTED_PROXIES in .env. The default trusts only loopback.
| Rollback, should a real client ever arrive looking like the proxy: set
| TRUSTED_PROXIES=* and run php artisan config:cache.
|
*/

return [
    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,::1'),
];
