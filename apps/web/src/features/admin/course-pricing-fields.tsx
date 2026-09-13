'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';
import { dateTime, number, price } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

/** What the curriculum payload says about a course's price. */
export type CoursePricing = {
  type: 'free' | 'paid' | 'unpriced';
  regular_minor: number | null;
  offer_minor: number | null;
  offer_ends_at: string | null;
};

/** What the course endpoint accepts as `pricing`. */
export type CoursePricingWrite =
  | { type: 'free' }
  | {
      type: 'paid';
      regular_minor: number;
      offer_minor: number | null;
      offer_ends_at: string | null;
    };

const INPUT = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy';

/** Bangladesh keeps one offset all year, so its local time is a fixed shift from UTC. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const QUICK_HOURS = [24, 48, 72, 168] as const;

/*
  The offer's end is entered in Bangladesh time whatever the browser's zone,
  the time every page shows: the same instant renders the same on the server
  and in the browser, and a value saved again is unchanged, so an offer's
  countdown is not restarted by saving the course.
*/

/** A `datetime-local` value in Bangladesh time, to the minute. */
export function toDhakaInput(value: string | number | Date): string {
  return new Date(new Date(value).getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 16);
}

/** The instant a `datetime-local` value in Bangladesh time names. */
export function fromDhakaInput(value: string): string {
  return new Date(`${value}:00+06:00`).toISOString();
}

/** Reads the pricing fields back out of the course form. */
export function pricingFromForm(data: FormData): CoursePricingWrite {
  if (data.get('price_type') === 'free') {
    return { type: 'free' };
  }

  const minor = (name: string) => Math.round(Number(data.get(name)) * 100);
  const hasOffer = data.get('offer_enabled') === 'on';
  const endsAt = String(data.get('offer_ends_at') ?? '');

  return {
    type: 'paid',
    regular_minor: minor('regular_bdt'),
    offer_minor: hasOffer ? minor('offer_bdt') : null,
    offer_ends_at: hasOffer && endsAt ? fromDhakaInput(endsAt) : null,
  };
}

function percentOff(regular: number, offer: number): string {
  return regular > 0 && offer > 0 && offer < regular
    ? String(Math.round((1 - offer / regular) * 100))
    : '';
}

/**
 * A course's price in the editor: free, or a regular price with an optional
 * offer that ends at a set time - after which the regular price applies again
 * by itself. The discount can be given as a percentage or as the offer price;
 * each fills in the other.
 */
export function CoursePricingFields({
  initial,
  fallbackMinor,
}: {
  initial?: CoursePricing | null;
  fallbackMinor?: number | null;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';

  const running =
    initial?.type === 'paid' && initial.offer_minor !== null && initial.offer_ends_at !== null;
  const [type, setType] = useState<'free' | 'paid'>(initial?.type === 'free' ? 'free' : 'paid');
  const [regular, setRegular] = useState(
    String((initial?.regular_minor || fallbackMinor || 150000) / 100),
  );
  const [offerOn, setOfferOn] = useState(running);
  const [offer, setOffer] = useState(running ? String((initial.offer_minor as number) / 100) : '');
  const [percent, setPercent] = useState(
    running ? percentOff(initial.regular_minor ?? 0, initial.offer_minor as number) : '',
  );
  const [endsAt, setEndsAt] = useState(
    running ? toDhakaInput(initial.offer_ends_at as string) : '',
  );

  function changeRegular(value: string) {
    setRegular(value);
    setPercent(percentOff(Number(value), Number(offer)));
  }

  function changeOffer(value: string) {
    setOffer(value);
    setPercent(percentOff(Number(regular), Number(value)));
  }

  function changePercent(value: string) {
    setPercent(value);
    const off = Number(value);

    if (value !== '' && off > 0 && off < 100 && Number(regular) > 0) {
      setOffer(String(Math.round((Number(regular) * (100 - off)) / 100)));
    }
  }

  function toggleOffer(checked: boolean) {
    setOfferOn(checked);

    // Three days is the usual length of an offer; one click sets another.
    if (checked && !endsAt) {
      setEndsAt(toDhakaInput(Date.now() + 72 * HOUR_MS));
    }
  }

  const regularMinor = Math.round(Number(regular) * 100);
  const offerMinor = Math.round(Number(offer) * 100);
  const showOffer = offerOn && offerMinor > 0 && offerMinor < regularMinor && endsAt !== '';
  const money = (minor: number) => price(minor, 'BDT', locale);

  const summary =
    type === 'free'
      ? bn
        ? 'শিক্ষার্থীরা দেখবে: ফ্রি — পেমেন্ট ছাড়াই ভর্তি হতে পারবে।'
        : 'Students see: Free — they can enrol without paying.'
      : showOffer
        ? bn
          ? `শিক্ষার্থীরা দেখবে: ${money(offerMinor)} (আগে ${money(regularMinor)}, ${number(Number(percent), locale)}% ছাড়) — অফার শেষ ${dateTime(fromDhakaInput(endsAt), locale)}; তারপর আবার ${money(regularMinor)}।`
          : `Students see: ${money(offerMinor)} instead of ${money(regularMinor)} (${percent}% off) until ${dateTime(fromDhakaInput(endsAt), locale)}, then ${money(regularMinor)} again.`
        : bn
          ? `শিক্ষার্থীরা দেখবে: ${money(regularMinor)}`
          : `Students see: ${money(regularMinor)}`;

  return (
    <fieldset className="space-y-4 rounded-lg border border-line p-4">
      <legend className="px-2 text-lg font-bold">{bn ? 'কোর্সের দাম' : 'Course price'}</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['free', 'paid'] as const).map((option) => (
          <label
            key={option}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
              type === option ? 'border-blue bg-blue-soft' : 'border-line bg-white',
            )}
          >
            <input
              type="radio"
              name="price_type"
              value={option}
              checked={type === option}
              onChange={() => setType(option)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-navy">
                {option === 'free' ? (bn ? 'ফ্রি' : 'Free') : bn ? 'পেইড' : 'Paid'}
              </span>
              <span className="block text-xs text-muted">
                {option === 'free'
                  ? bn
                    ? 'যে কেউ পেমেন্ট ছাড়াই ভর্তি হতে পারবে'
                    : 'Anyone can enrol without paying'
                  : bn
                    ? 'নির্ধারিত দাম, চাইলে সীমিত সময়ের অফারসহ'
                    : 'A set price, with an optional limited-time offer'}
              </span>
            </span>
          </label>
        ))}
      </div>

      {type === 'paid' ? (
        <>
          <label className="block">
            {bn ? 'মূল দাম (৳)' : 'Regular price (BDT)'}
            <input
              required
              name="regular_bdt"
              type="number"
              min="1"
              max="1000000"
              step="0.01"
              value={regular}
              onChange={(event) => changeRegular(event.target.value)}
              className={INPUT}
            />
          </label>

          <label className="flex items-center gap-2 font-semibold text-navy">
            <input
              type="checkbox"
              name="offer_enabled"
              checked={offerOn}
              onChange={(event) => toggleOffer(event.target.checked)}
            />
            {bn ? 'সীমিত সময়ের অফার দিন' : 'Run a limited-time offer'}
          </label>

          {offerOn ? (
            <div className="space-y-3 rounded-lg bg-surface p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  {bn ? 'ছাড় (%)' : 'Discount (%)'}
                  <input
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={percent}
                    onChange={(event) => changePercent(event.target.value)}
                    className={INPUT}
                  />
                </label>
                <label>
                  {bn ? 'অফার মূল্য (৳)' : 'Offer price (BDT)'}
                  <input
                    required
                    name="offer_bdt"
                    type="number"
                    min="1"
                    max={Number(regular) > 1 ? Number(regular) - 0.01 : undefined}
                    step="0.01"
                    value={offer}
                    onChange={(event) => changeOffer(event.target.value)}
                    className={INPUT}
                  />
                </label>
              </div>

              <label className="block">
                {bn ? 'অফার শেষ হবে (বাংলাদেশ সময়)' : 'Offer ends (Bangladesh time)'}
                <input
                  required
                  name="offer_ends_at"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className={INPUT}
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">{bn ? 'এখন থেকে:' : 'From now:'}</span>
                {QUICK_HOURS.map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setEndsAt(toDhakaInput(Date.now() + hours * HOUR_MS))}
                    className="rounded-full border border-line bg-white px-3 py-1 text-sm font-semibold text-navy hover:border-blue hover:text-blue"
                  >
                    {hours === 168
                      ? bn
                        ? '৭ দিন'
                        : '7 days'
                      : bn
                        ? `${number(hours, locale)} ঘণ্টা`
                        : `${hours} hours`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="rounded-lg bg-blue-soft p-3 text-sm text-navy" aria-live="polite">
        {summary}
      </p>
    </fieldset>
  );
}
