<x-mail::message>
# Order {{ $order->number }}

Assalamu alaikum {{ $order->billing_name }},

Your order has been confirmed. The details are below.

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
