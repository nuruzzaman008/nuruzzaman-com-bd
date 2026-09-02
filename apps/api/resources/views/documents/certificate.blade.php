<!doctype html>
<html lang="bn">
<head>
    <meta charset="utf-8">
    <title>Certificate {{ $certificate->verification_id }}</title>
    <style>
        :root { color-scheme: light; }
        body { font-family: "Noto Sans Bengali", "Segoe UI", system-ui, sans-serif; margin: 0; background: #f7f9fc; color: #17212b; }
        .sheet { width: 1000px; max-width: 96vw; margin: 40px auto; background: #fff; border: 12px solid #0b1f33; padding: 56px 64px; }
        .eyebrow { letter-spacing: .18em; text-transform: uppercase; font-size: 12px; color: #1261a6; }
        h1 { font-size: 34px; margin: 12px 0 4px; }
        .name { font-size: 42px; margin: 28px 0 8px; color: #0b1f33; }
        .meta { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; color: #47566a; }
        .verify { margin-top: 8px; font-size: 12px; color: #47566a; }
        code { background: #eef2f7; padding: 2px 6px; border-radius: 4px; }
    </style>
</head>
<body>
<div class="sheet">
    <p class="eyebrow">{{ $site['name'] }}</p>
    <h1>Certificate of Completion</h1>
    <p>This certifies that</p>
    <p class="name">{{ $certificate->recipient_name }}</p>
    <p>has completed the course <strong>{{ $certificate->course_title }}</strong>.</p>

    <div class="meta">
        <div>
            <div>Issued: {{ $certificate->issued_at?->timezone($site['timezone'])->format('d M Y') }}</div>
            @if ($certificate->score_percent !== null)
                <div>Progress recorded: {{ $certificate->score_percent }}%</div>
            @endif
        </div>
        <div>
            <div>Verification ID</div>
            <div><code>{{ $certificate->verification_id }}</code></div>
        </div>
    </div>

    <p class="verify">
        Verify at {{ rtrim($site['url'], '/') }}/verify/{{ $certificate->verification_id }}.
        This certificate records course completion only. It is not a professional
        licence and does not transfer engineering responsibility.
    </p>
</div>
</body>
</html>
