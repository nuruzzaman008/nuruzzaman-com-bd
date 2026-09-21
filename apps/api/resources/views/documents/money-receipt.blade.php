{{--
    The money receipt, drawn by mPDF (App\Services\Receipts\MoneyReceipt).
    mPDF reads a subset of CSS: tables, borders, backgrounds and padding, no
    flexbox or grid - so the layout is tables, as receipts have always been.
--}}
@php
    $money = fn (int $minor): string => number_format($minor / 100, 2);
@endphp
<html>
<head>
<style>
    body { font-family: dejavusans; font-size: 9.5pt; color: #17212b; }
    .band { background-color: #e7f0f9; border-bottom: 2px solid #0b1f33; }
    .mark { background-color: #f2a900; color: #0b1f33; font-size: 17pt; font-weight: bold; text-align: center; }
    .title { font-size: 19pt; font-weight: bold; color: #0b1f33; letter-spacing: 1px; }
    .site { font-size: 12.5pt; font-weight: bold; color: #1261a6; }
    .muted { color: #5b6b7b; font-size: 8.5pt; }
    .copy { border: 1.4px solid #0b1f33; font-weight: bold; font-size: 9pt; padding: 3px 10px; }
    .details td { padding: 2px 0; vertical-align: top; }
    .label { color: #5b6b7b; width: 30mm; }
    .items { border-collapse: collapse; width: 100%; }
    .items th { background-color: #0b1f33; color: #ffffff; font-size: 9pt; padding: 5px 6px; border: 1px solid #0b1f33; }
    .items td { border: 1px solid #b9c6d4; padding: 5px 6px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .centre { text-align: center; }
    .total td { font-weight: bold; background-color: #f7f9fc; }
    .status { border: 1.2px solid #16794b; color: #16794b; font-weight: bold; padding: 1px 6px; }
    .stamp { border: 3px solid #1261a6; color: #1261a6; font-size: 46pt; font-weight: bold; text-align: center; letter-spacing: 6px; }
    /* Names and titles may be Bangla, which the bundled font draws properly
       only in its regular weight - bold Bangla loses its joined letters. So
       these stand out by size and colour, not weight. */
    .name { color: #0b1f33; font-size: 10.5pt; }
    .item { color: #0b1f33; font-size: 10pt; }
    .foot { border-top: 1px solid #b9c6d4; color: #5b6b7b; font-size: 8.5pt; text-align: center; padding-top: 6px; }
</style>
</head>
<body>

<table width="100%" class="band" cellpadding="8">
    <tr>
        <td width="18mm" class="mark">NB</td>
        <td>
            <div class="title">MONEY RECEIPT</div>
            <div class="site">{{ $site['name'] }}</div>
            <div class="muted">{{ $host }}@if ($site['support_email']) &nbsp;·&nbsp; {{ $site['support_email'] }}@endif</div>
        </td>
    </tr>
</table>

<p style="text-align: center; margin: 10px 0 8px;"><span class="copy">CUSTOMER COPY</span></p>

<table width="100%" cellpadding="0">
    <tr>
        <td width="62%" style="vertical-align: top;">
            <table class="details" width="100%">
                <tr><td class="label">Receipt No</td><td>: <b>{{ $invoice->number }}</b></td></tr>
                <tr><td class="label">Receipt Date</td><td>: {{ $issuedAt->format('d/m/Y, h:i A') }}</td></tr>
                <tr><td class="label">Order No</td><td>: {{ $order->number }}</td></tr>
                <tr><td class="label">Received from</td><td>: <span class="name">{{ $order->billing_name }}</span></td></tr>
                @if ($order->billing_phone)
                    <tr><td class="label">Phone</td><td>: {{ $order->billing_phone }}</td></tr>
                @endif
                <tr><td class="label">Email</td><td>: {{ $order->billing_email }}</td></tr>
            </table>
        </td>
        <td width="38%" style="text-align: right; vertical-align: top;">
            <barcode code="{{ $invoice->number }}" type="C128B" size="0.85" height="0.9" />
            <div class="muted">{{ $invoice->number }}</div>
        </td>
    </tr>
</table>

<table class="items" style="margin-top: 10px;">
    <thead>
        <tr>
            <th width="8%">SL</th>
            <th style="text-align: left;">DETAILS</th>
            <th width="16%" class="num">AMOUNT</th>
            <th width="8%">QTY</th>
            <th width="17%" class="num">TOTAL</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($items as $index => $item)
            <tr>
                <td class="centre">{{ $index + 1 }}</td>
                <td><span class="item">{{ $item['name'] ?? '' }}</span>@if (! empty($item['sku']))<br><span class="muted">{{ $item['sku'] }}</span>@endif</td>
                <td class="num">{{ $money((int) ($item['unit_price_minor'] ?? 0)) }}</td>
                <td class="centre">{{ $item['quantity'] ?? 1 }}</td>
                <td class="num">{{ $money((int) ($item['line_total_minor'] ?? 0)) }}</td>
            </tr>
        @endforeach
        @if ($discount > 0 || $tax > 0)
            <tr>
                <td colspan="4" class="num">Subtotal</td>
                <td class="num">{{ $money($subtotal) }}</td>
            </tr>
        @endif
        @if ($discount > 0)
            <tr>
                <td colspan="4" class="num">Discount</td>
                <td class="num">-{{ $money($discount) }}</td>
            </tr>
        @endif
        @if ($tax > 0)
            <tr>
                <td colspan="4" class="num">Tax</td>
                <td class="num">{{ $money($tax) }}</td>
            </tr>
        @endif
        <tr class="total">
            <td colspan="4" class="num">Total (BDT)</td>
            <td class="num">{{ $money($total) }}</td>
        </tr>
        <tr>
            <td colspan="5">Taka (in words): <b>{{ $words }}</b></td>
        </tr>
    </tbody>
</table>

<table width="100%" class="details" style="margin-top: 12px;">
    <tr><td class="label">Status</td><td>: <span class="status">Paid</span></td></tr>
    <tr><td class="label">Payment method</td><td>: {{ $payment['method'] }}</td></tr>
    @if ($payment['reference'])
        <tr><td class="label">Transaction ID</td><td>: <b>{{ $payment['reference'] }}</b></td></tr>
    @endif
    @if ($paidAt)
        <tr><td class="label">Paid on</td><td>: {{ $paidAt->format('d/m/Y, h:i A') }}</td></tr>
    @endif
</table>

<table width="100%" style="margin-top: 16px;">
    <tr>
        <td width="48%"><div class="stamp">PAID</div></td>
        <td width="52%" style="vertical-align: bottom;">
            {{-- mPDF has no margin-left: auto; a right-aligned table places the line. --}}
            <table align="right" width="62mm">
                <tr>
                    <td style="border-top: 1px solid #17212b; text-align: center; padding-top: 3px;">
                        <span class="name">{{ $site['name'] }}</span><br>
                        <span class="muted">Received by</span>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>

<div class="foot" style="margin-top: 28px;">
    N.B.: This is a system generated receipt and no signature is required.
    <br>{{ $host }}
</div>

</body>
</html>
