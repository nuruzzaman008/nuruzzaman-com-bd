{!! $title !!}

@if ($body !== '')
{!! $body !!}
@endif
@if ($detail)

{!! $detail !!}
@endif
@if ($url)

{{ $lang === 'en' ? 'Open' : 'খুলুন' }}: {!! $url !!}
@endif

--
{!! $site["name"] !!}
{{ $lang === 'en' ? 'Choose which emails you receive:' : 'কোন email পাবেন তা বদলাতে:' }} {!! $settingsUrl !!}
