import Link from 'next/link';
import type { Product } from '@nuruzzaman/contracts';
import { tryPublicApi } from '@/lib/api/server';
import { localizePath, type Locale } from '@/lib/i18n/locale';
import { PriceTag } from '@/components/ui/price';
import { AddToCart } from '@/features/catalog/add-to-cart';

export async function CreditGuide({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const en = locale === 'en';
  const [credits, software] = await Promise.all([
    tryPublicApi<{ data: Product }>('/products/nb-credit-refill', { query: { locale }, revalidate: 0, tags: ['products', 'product:nb-credit-refill'] }),
    tryPublicApi<{ data: Product }>('/products/nb-engineering-tools', { query: { locale }, revalidate: 0, tags: ['products', 'product:nb-engineering-tools'] }),
  ]);
  const packs = (credits?.data.variants ?? []).filter(v => ['NBC-500', 'NBC-2000', 'NBC-5000', 'NBC-15000'].includes(v.sku) && v.is_purchasable).sort((a,b) => Number(a.sku.replace('NBC-', '')) - Number(b.sku.replace('NBC-', '')));
  const license = software?.data.variants?.find(v => v.sku === 'NBET-V6-SINGLE');
  const steps = en ? [
    'Sign in or create an account. Choose a software licence or NB Credit pack and add it to your cart.',
    'At checkout, check the order total and choose an enabled mobile banking or bank-transfer method. Use only the receiving account and instructions shown on the payment page.',
    'Send the exact amount and submit your Transaction ID and sender mobile/account number. Never share your PIN, password or OTP.',
    'Your payment stays pending while an admin checks the receiving statement. Follow the verification status from Account → Orders. Do not pay again while it is pending.',
    'After approval, course/product access is processed. For software activation or a credit refill, open Account → Activation requests and provide the order reference, request type and correct Machine ID; include the License ID where applicable.',
    'Follow the approved activation/refill response in your account. Apply the issued key to the matching AutoCAD installation and check License & Tokens for the updated balance. Payment submission alone does not add credits to AutoCAD.',
  ] : [
    'Login বা account তৈরি করুন। Software licence অথবা NB Credit pack বেছে cart-এ যোগ করুন।',
    'Checkout-এ মোট দাম দেখে চালু থাকা mobile banking বা bank transfer method বেছে নিন। Payment page-এ দেখানো receiving account ও নির্দেশনা অনুসরণ করুন।',
    'সঠিক পরিমাণ পাঠিয়ে Transaction ID এবং sender mobile/account number জমা দিন। PIN, password বা OTP দেবেন না।',
    'Admin receiving statement যাচাই করা পর্যন্ত payment pending থাকবে। Account → Orders থেকে status দেখুন। Pending থাকা অবস্থায় আবার payment করবেন না।',
    'Approve হলে course/product access প্রক্রিয়া সম্পন্ন হবে। Software activation বা credit refill-এর জন্য Account → Activation requests-এ order reference, request type ও সঠিক Machine ID দিন; প্রযোজ্য ক্ষেত্রে License ID যোগ করুন।',
    'Account-এ approved activation/refill response-এর নির্দেশনা অনুসরণ করুন। একই AutoCAD installation-এ issued key apply করে License & Tokens-এ balance যাচাই করুন। শুধু payment জমা দিলেই AutoCAD-এ credits যোগ হবে না।',
  ];
  return <section id="credit-pricing" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 sm:p-8">
    <p className="text-sm font-semibold text-teal">NB Engineering Tools · NB Credits (Token)</p>
    <h2 className="mt-2 text-3xl font-bold text-navy">{en ? 'Software & token prices' : 'Software ও Token-এর দাম'}</h2>
    <p className="mt-3 text-muted">{en ? 'A licence activates the software on one machine. NB Credits are separate usage credits for paid engineering operations. Choose the refill amount that suits your work.' : 'Licence দিয়ে একটি machine-এ software activate হয়। NB Credits হলো paid engineering operation-এর আলাদা usage credit। কাজের প্রয়োজন অনুযায়ী refill pack বেছে নিন।'}</p>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-blue-soft p-5"><div><h3 className="font-bold">{en ? 'Software licence — 1 PC' : 'Software licence — ১টি PC'}</h3><p className="mt-1 text-sm">NB Engineering Tools</p></div><PriceTag value={license?.price ?? null} size="lg" /><Link className="font-semibold text-blue underline" href={localizePath('/engineering-tools', locale)}>{en ? 'View software' : 'Software দেখুন'}</Link></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{packs.map(pack => <div key={pack.id} className="rounded-xl border border-line p-5"><h3 className="mb-3 text-xl font-bold">{Number(pack.sku.replace('NBC-', '')).toLocaleString(en ? 'en-BD' : 'bn-BD')} NB Credits</h3><AddToCart variants={[pack]} openCart /></div>)}</div>
    {!packs.length && <p className="mt-4">{en ? 'Credit prices are temporarily unavailable. Please contact support before paying.' : 'Credit-এর দাম আপাতত পাওয়া যাচ্ছে না। Payment-এর আগে support-এ যোগাযোগ করুন।'}</p>}
    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 font-semibold text-navy">{en ? 'All new payments are manually verified by our admin. Access or refill processing starts after approval.' : 'সব নতুন payment আমাদের admin manually যাচাই করবেন। Approve হওয়ার পর access বা refill processing শুরু হবে।'}</p>
    {compact ? <Link className="mt-5 inline-block font-semibold text-blue underline" href={`${localizePath('/engineering-tools', locale)}#payment-guide`}>{en ? 'Read the complete payment & refill guide →' : 'Payment ও refill-এর সম্পূর্ণ নিয়ম পড়ুন →'}</Link> : <>
      <h3 id="payment-guide" className="mt-8 scroll-mt-24 text-2xl font-bold">{en ? 'How to purchase, pay and refill' : 'কেনা, payment ও refill-এর সম্পূর্ণ নিয়ম'}</h3>
      <ol className="mt-5 list-decimal space-y-4 ps-6 text-muted">{steps.map(step => <li key={step}>{step}</li>)}</ol>
      <div className="mt-6 space-y-3 text-sm text-muted"><p>{en ? 'Token usage varies by tool and operation. The displayed pack size is a credit balance, not a guaranteed number of drawings or projects. Follow the token charge shown by your installed software.' : 'Tool ও operation অনুযায়ী token খরচ আলাদা। Pack-এর সংখ্যা credit balance; একই সংখ্যক drawing বা project-এর নিশ্চয়তা নয়। আপনার installed software-এ দেখানো token charge অনুসরণ করুন।'}</p><p>{en ? 'Use the Machine ID from the computer where the licence is installed. A new computer or Windows reinstall may require support verification; remaining credits are not guaranteed to transfer automatically.' : 'যে computer-এ licence আছে সেই computer-এর Machine ID দিন। Computer পরিবর্তন বা Windows reinstall হলে support verification লাগতে পারে; অবশিষ্ট credits automatic transfer হওয়ার নিশ্চয়তা নেই।'}</p><p>{en ? 'A rejected payment shows the admin’s reason in your order’s payment history. Contact support with your order reference if you need help. Custom quantities and office licences require a separate confirmed quotation.' : 'Payment reject হলে order-এর payment history-তে admin-এর কারণ দেখবেন। সাহায্যের জন্য order reference দিয়ে support-এ যোগাযোগ করুন। Custom quantity ও office licence-এর জন্য আলাদা confirmed quotation প্রয়োজন।'}</p></div>
      <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-blue"><Link href="/account/orders">{en ? 'My orders' : 'আমার orders'}</Link><Link href="/account/activation-requests">{en ? 'Activation / refill request' : 'Activation / refill request'}</Link><Link href={localizePath('/support/license-recovery', locale)}>{en ? 'Recovery policy' : 'Recovery policy'}</Link><Link href={localizePath('/contact', locale)}>{en ? 'Contact support' : 'Support-এ যোগাযোগ'}</Link></div>
    </>}
  </section>;
}
