<x-mail::message>
# Activation request {{ $request->reference }}

Status: **{{ str_replace('_', ' ', $request->status->value) }}**
Machine: `{{ $request->machine_id_masked }}`

@if ($request->vendor_response)
{{ $request->vendor_response }}
@else
There is no response to share yet. You will get another email when this changes.
@endif

<x-mail::button :url="rtrim($site['url'], '/') . '/account/activation-requests'">
Open your activation requests
</x-mail::button>

Thanks,<br>
{{ $site['name'] }}
</x-mail::message>
