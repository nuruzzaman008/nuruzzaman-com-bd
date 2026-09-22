<!DOCTYPE html>
<html lang="{{ $lang }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Noto Sans Bengali','Segoe UI',Arial,sans-serif;color:#13233d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e3e6ec;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e3e6ec;">
<strong style="font-size:15px;">{{ $site['name'] }}</strong>
</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 10px;font-size:19px;line-height:1.4;">{{ $title }}</h1>
@if ($body !== '')
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#39465c;">{{ $body }}</p>
@endif
@if ($detail)
<p style="margin:0 0 18px;padding:12px 14px;border-left:3px solid #f2b705;background:#fbf8ec;font-size:14px;line-height:1.6;white-space:pre-wrap;">{{ $detail }}</p>
@endif
@if ($url)
<p style="margin:22px 0 4px;">
<a href="{{ $url }}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#13233d;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">{{ $lang === 'en' ? 'Open' : 'খুলুন' }}</a>
</p>
@endif
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e3e6ec;font-size:12px;line-height:1.6;color:#6b7589;">
{{ $lang === 'en' ? 'Choose which emails you receive:' : 'কোন email পাবেন তা বদলাতে:' }}
<a href="{{ $settingsUrl }}" style="color:#6b7589;">{{ $settingsUrl }}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
