<x-mail::message>
# Your question has an answer

Hello {{ $question->user?->name }},

**{{ $answeredBy }}** answered your question in **{{ $where }}**.

**Your question:** {{ $question->title }}

<x-mail::panel>
{{ $answer }}
</x-mail::panel>

<x-mail::button :url="$url">
See the answer
</x-mail::button>

Thanks,<br>
{{ $site['name'] }}
</x-mail::message>
