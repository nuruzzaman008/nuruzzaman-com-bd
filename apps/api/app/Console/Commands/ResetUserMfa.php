<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Audit;
use App\Support\TwoFactor;
use Illuminate\Console\Command;

/**
 * The way back in when an authenticator app is gone with the phone.
 *
 * Deliberately not on the website: anyone who could clear someone else's second
 * step from a browser would have removed the point of having one. It needs a
 * shell on the server, which is the owner.
 */
class ResetUserMfa extends Command
{
    protected $signature = 'nb:mfa-reset {email : The account that lost its authenticator}';

    protected $description = 'Clear two-step verification for one account so it can be set up again';

    public function handle(): int
    {
        $user = User::query()->where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error('No account with that email.');

            return self::FAILURE;
        }

        if (! $user->mfa_secret && ! $user->mfa_confirmed_at) {
            $this->info('That account has no two-step verification set up.');

            return self::SUCCESS;
        }

        // Recovery codes and the replay marker go with it.
        TwoFactor::clear($user);

        Audit::record('auth.mfa_reset_by_owner', $user, ['email' => $user->email], $user->getKey());

        $this->info('Cleared. '.$user->email.' will be asked to set it up again on the next visit to the dashboard.');

        return self::SUCCESS;
    }
}
