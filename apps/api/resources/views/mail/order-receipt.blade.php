<x-mail::message>
# Order {{ $order->number }}

Assalamu alaikum {{ $order->billing_name }},

Your order has been confirmed. The details are below, and your money receipt is attached as a PDF.

@foreach ($walletCredits as $credit)
**Wallet credited: {{ $credit->delta }} tokens**

License: {{ $credit->license_code }}

Transaction: {{ $credit->transaction_id }}

Your website wallet has been updated. Open NB ONLINE in AutoCAD and choose Sync Now (or wait for automatic sync while connected). Legacy offline tokens remain separate.

<x-mail::button :url="rtrim($site['url'], '/') . '/account/wallets'">
View wallet / ওয়ালেট দেখুন
</x-mail::button>
@endforeach

<x-mail::table>
| Item | Qty | Amount (BDT) |
|:-----|:---:|-------------:|
@foreach ($order->items as $item)
| {{ $item->product_name }} - {{ $item->variant_name }} | {{ $item->quantity }} | {{ number_format($item->line_total_minor / 100, 2) }} |
@endforeach
| **Total** | | **{{ number_format($order->total_minor / 100, 2) }}** |
</x-mail::table>

<x-mail::button :url="rtrim($site['url'], '/') . '/account/orders'">
View your order
</x-mail::button>

@if ($site['support_email'])
Questions? Reply to this email or write to {{ $site['support_email'] }}.
@endif

Thanks,<br>
{{ $site['name'] }}
</x-mail::message>
