<x-mail::message>
# Your two-step verification was reset

Hello {{ $user->name }},

**{{ $resetBy }}** cleared the two-step verification on your staff account at {{ now()->timezone($site['timezone'] ?? 'Asia/Dhaka')->format('j M Y, H:i') }}. Your old authenticator entry and recovery codes no longer work.

The next time you open the dashboard you will be asked to set up Google Authenticator again, with a new QR code.

**If you did not ask for this,** tell the site owner straight away and change your password.

<x-mail::button :url="rtrim($site['url'], '/') . '/dashboard/security?setup=1'">
Set it up again
</x-mail::button>

Thanks,<br>
{{ $site['name'] }}
</x-mail::message>
