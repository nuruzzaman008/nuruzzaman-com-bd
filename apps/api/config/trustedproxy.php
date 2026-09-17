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
| Production sets TRUSTED_PROXIES in .env to loopback plus the one address
| Next.js calls from (115.187.18.50). List exact addresses, not the host's
| subnet: a /28 also trusted neighbours that are not this server. LiteSpeed in
| front of the API already swaps in the first X-Forwarded-For entry for
| requests from this server, which is why Next.js sends exactly one entry;
| this list is the second line, for when that server setting changes.
|
| The default trusts only loopback. Rollback, should real visitors ever all
| show up as one address: widen TRUSTED_PROXIES and run
| php artisan config:cache.
|
*/

return [
    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,::1'),
];
