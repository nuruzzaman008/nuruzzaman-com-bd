<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Re: {{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Noto Sans Bengali','Segoe UI',Arial,sans-serif;color:#13233d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e3e6ec;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e3e6ec;">
<strong style="font-size:15px;">{{ $site['name'] }}</strong>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 14px;font-size:15px;">{{ $name }},</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;white-space:pre-wrap;">{{ $answer }}</p>
<p style="margin:0 0 22px;font-size:14px;color:#39465c;">{{ $staffName }}<br>{{ $site['name'] }}</p>
<p style="margin:0 0 6px;font-size:12px;color:#6b7589;">Your message / আপনার বার্তা:</p>
<p style="margin:0;padding:12px 14px;border-left:3px solid #e3e6ec;background:#f8f9fb;font-size:13px;line-height:1.6;color:#39465c;white-space:pre-wrap;">{{ $original }}</p>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e3e6ec;font-size:12px;line-height:1.6;color:#6b7589;">
{{ $site['url'] }}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
