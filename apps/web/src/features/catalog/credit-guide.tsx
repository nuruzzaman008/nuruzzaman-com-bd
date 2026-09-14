import Link from 'next/link';
import type { Product } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { tryPublicApi } from '@/lib/api/server';
import { localizePath, type Locale } from '@/lib/i18n/locale';

const PACK_SKUS = ['NBC-500', 'NBC-2000', 'NBC-5000', 'NBC-15000'];

/** The licences on sale, in the order a buyer compares them. */
const LICENCES = [
  {
    sku: 'NBET-V6-SINGLE',
    bn: '১টি PC',
    en: '1 PC',
    noteBn: 'সাথে 1,000 NB Credits (activation-এর পর)',
    noteEn: 'Includes 1,000 NB Credits (after activation)',
  },
  {
    sku: 'NBET-V6-OFFICE-3',
    bn: 'অফিস প্যাক — ৩টি PC',
    en: 'Office pack — 3 PCs',
    noteBn: 'একটি লাইসেন্স, ৩টি computer পর্যন্ত',
    noteEn: 'One licence for up to 3 computers',
  },
  {
    sku: 'NBET-V6-OFFICE-5',
    bn: 'অফিস প্যাক — ৫টি PC',
    en: 'Office pack — 5 PCs',
    noteBn: 'একটি লাইসেন্স, ৫টি computer পর্যন্ত',
    noteEn: 'One licence for up to 5 computers',
  },
];

/**
 * Licence and NB Credit prices, and how to buy. Used in full on the
 * engineering tools page and compact on the home page. What licences and
 * credits are, and their policies, are explained once on the engineering tools
 * page; this block only prices them.
 */
export async function CreditGuide({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const en = locale === 'en';
  const [credits, software] = await Promise.all([
    tryPublicApi<{ data: Product }>('/products/nb-credit-refill', {
      query: { locale },
      revalidate: 0,
      tags: ['products', 'product:nb-credit-refill'],
    }),
    tryPublicApi<{ data: Product }>('/products/nb-engineering-tools', {
      query: { locale },
      revalidate: 0,
      tags: ['products', 'product:nb-engineering-tools'],
    }),
  ]);
  const packs = (credits?.data.variants ?? [])
    .filter((variant) => PACK_SKUS.includes(variant.sku) && variant.is_purchasable)
    .sort((a, b) => Number(a.sku.replace('NBC-', '')) - Number(b.sku.replace('NBC-', '')));
  const licences = LICENCES.flatMap((licence) => {
    const variant = software?.data.variants?.find((row) => row.sku === licence.sku);

    return variant ? [{ ...licence, variant }] : [];
  });
  const launch = licences.find((licence) => licence.sku === 'NBET-V6-SINGLE')?.variant.price
    ?.compare_at_minor;

  const steps = en
    ? [
        'Sign in or create an account. Choose a software licence or NB Credit pack and add it to your cart.',
        'At checkout, check the order total and choose an enabled mobile banking or bank-transfer method. Use only the receiving account and instructions shown on the payment page.',
        'Send the exact amount and submit your Transaction ID and sender mobile/account number. Never share your PIN, password or OTP.',
        'Your payment stays pending while an admin checks the receiving statement. Follow the verification status from Account → Orders. Do not pay again while it is pending.',
        'After approval, open Account → Activation requests and provide the order reference, request type and correct Machine ID; include the License ID where applicable.',
        'Follow the approved activation/refill response in your account. Apply the issued key to the matching AutoCAD installation and check License & Tokens for the updated balance. Payment alone does not add credits to AutoCAD.',
      ]
    : [
        'Login বা account তৈরি করুন। Software licence অথবা NB Credit pack বেছে cart-এ যোগ করুন।',
        'Checkout-এ মোট দাম দেখে চালু থাকা mobile banking বা bank transfer method বেছে নিন। Payment page-এ দেখানো receiving account ও নির্দেশনা অনুসরণ করুন।',
        'সঠিক পরিমাণ পাঠিয়ে Transaction ID এবং sender mobile/account number জমা দিন। PIN, password বা OTP দেবেন না।',
        'Admin receiving statement যাচাই করা পর্যন্ত payment pending থাকবে। Account → Orders থেকে status দেখুন। Pending থাকা অবস্থায় আবার payment করবেন না।',
        'Approve হলে Account → Activation requests-এ order reference, request type ও সঠিক Machine ID দিন; প্রযোজ্য ক্ষেত্রে License ID যোগ করুন।',
        'Account-এ approved activation/refill response-এর নির্দেশনা অনুসরণ করুন। একই AutoCAD installation-এ issued key apply করে License & Tokens-এ balance যাচাই করুন। শুধু payment জমা দিলেই AutoCAD-এ credits যোগ হবে না।',
      ];

  return (
    <section
      id="credit-pricing"
      className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 sm:p-8"
    >
      <p className="text-sm font-semibold text-teal">NB Engineering Tools · NB Credits</p>
      <h2 className="mt-2 text-3xl font-bold text-navy">
        {en ? 'Software licence and NB Credit prices' : 'Software licence ও NB Credits-এর দাম'}
      </h2>
      <p className="mt-3 text-muted">
        {en
          ? 'A licence activates the software - on one PC, or on 3 or 5 PCs for an office. NB Credits pay for paid engineering operations; choose the pack that suits your work.'
          : 'লাইসেন্স দিয়ে software activate হয় — ১টি PC-তে, অথবা অফিসের জন্য ৩ বা ৫টি PC-তে। NB Credits দিয়ে paid engineering operation চলে; কাজের প্রয়োজন অনুযায়ী pack বেছে নিন।'}
      </p>

      <h3 className="mt-6 text-xl font-bold text-navy">
        {en ? 'Software licence' : 'Software licence'}
      </h3>
      {licences.length ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {licences.map((licence) => (
            <div key={licence.sku} className="rounded-xl bg-blue-soft p-5">
              <h4 className="font-bold text-navy">{en ? licence.en : licence.bn}</h4>
              <p className="mt-1 mb-3 text-sm text-muted">{en ? licence.noteEn : licence.noteBn}</p>
              <AddToCart variants={[licence.variant]} openCart />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3">
          {en
            ? 'Licence prices are temporarily unavailable. Please contact support before paying.'
            : 'লাইসেন্সের দাম আপাতত পাওয়া যাচ্ছে না। Payment-এর আগে support-এ যোগাযোগ করুন।'}
        </p>
      )}
      {launch ? (
        <p className="mt-3 text-sm font-semibold text-navy">
          {en
            ? 'The single-PC price is the launch price for the first 100 engineers.'
            : '১টি PC-র দামটি প্রথম ১০০ জন ইঞ্জিনিয়ারের জন্য লঞ্চ দাম।'}
        </p>
      ) : null}

      <h3 className="mt-8 text-xl font-bold text-navy">NB Credits</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {packs.map((pack) => (
          <div key={pack.id} className="rounded-xl border border-line p-5">
            <h4 className="mb-3 text-xl font-bold">
              {Number(pack.sku.replace('NBC-', '')).toLocaleString(en ? 'en-BD' : 'bn-BD')} NB
              Credits
            </h4>
            <AddToCart variants={[pack]} openCart />
          </div>
        ))}
      </div>
      {!packs.length && (
        <p className="mt-3">
          {en
            ? 'Credit prices are temporarily unavailable. Please contact support before paying.'
            : 'Credit-এর দাম আপাতত পাওয়া যাচ্ছে না। Payment-এর আগে support-এ যোগাযোগ করুন।'}
        </p>
      )}

      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 font-semibold text-navy">
        {en
          ? 'All new payments are manually verified by our admin. Access or refill processing starts after approval.'
          : 'সব নতুন payment আমাদের admin manually যাচাই করবেন। Approve হওয়ার পর access বা refill processing শুরু হবে।'}
      </p>
      {compact ? (
        <Link
          className="mt-5 inline-block font-semibold text-blue underline"
          href={`${localizePath('/engineering-tools', locale)}#payment-guide`}
        >
          {en
            ? 'Read the complete payment & refill guide →'
            : 'Payment ও refill-এর সম্পূর্ণ নিয়ম পড়ুন →'}
        </Link>
      ) : (
        <>
          <h3 id="payment-guide" className="mt-8 scroll-mt-24 text-2xl font-bold">
            {en ? 'How to purchase, pay and refill' : 'কেনা, payment ও refill-এর সম্পূর্ণ নিয়ম'}
          </h3>
          <ol className="mt-5 list-decimal space-y-4 ps-6 text-muted">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted">
            {en
              ? 'A rejected payment shows the admin’s reason in your order’s payment history. Contact support with your order reference if you need help, or for a custom number of credits.'
              : 'Payment reject হলে order-এর payment history-তে admin-এর কারণ দেখবেন। সাহায্যের জন্য, বা custom পরিমাণ credit-এর জন্য, order reference দিয়ে support-এ যোগাযোগ করুন।'}
          </p>
          <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-blue">
            <Link href="/account/orders">{en ? 'My orders' : 'আমার orders'}</Link>
            <Link href="/account/activation-requests">
              {en ? 'Activation / refill request' : 'Activation / refill request'}
            </Link>
            <Link href={localizePath('/support/license-recovery', locale)}>
              {en ? 'Recovery policy' : 'Recovery policy'}
            </Link>
            <Link href={localizePath('/contact', locale)}>
              {en ? 'Contact support' : 'Support-এ যোগাযোগ'}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
