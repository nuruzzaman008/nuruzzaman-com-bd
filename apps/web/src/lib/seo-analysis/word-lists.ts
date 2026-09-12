/**
 * Word lists for the two title checks that are about wording rather than
 * measurement: does the headline carry a power word, and does it carry any
 * sentiment at all.
 *
 * Both lists are short and hand-picked rather than scraped. A long list makes
 * the check trivial to pass by accident, which is worse than not having it:
 * the point is to make an author look at the headline again, not to hand out
 * a green tick for the word "new".
 *
 * Bengali entries are matched as substrings because the language inflects with
 * suffixes — সহজ / সহজে / সহজেই are one word for this purpose. Latin entries
 * are matched on word boundaries, so "free" does not fire inside "freelance".
 */

/** Words that make a headline promise something. */
export const POWER_WORDS = {
  bn: [
    'সহজ', 'দ্রুত', 'বিনামূল্যে', 'ফ্রি', 'সম্পূর্ণ', 'পূর্ণাঙ্গ', 'নিশ্চিত', 'প্রমাণিত',
    'সেরা', 'নতুন', 'ধাপে ধাপে', 'কার্যকর', 'নিরাপদ', 'সাশ্রয়ী', 'আসল', 'অফিসিয়াল',
    'বিশেষ', 'গোপন', 'অভিজ্ঞ', 'হাতে-কলমে', 'একদম', 'চূড়ান্ত',
  ],
  en: [
    'ultimate', 'complete', 'essential', 'proven', 'guaranteed', 'instant', 'free',
    'exclusive', 'secret', 'definitive', 'step-by-step', 'expert', 'official',
    'effortless', 'powerful', 'practical', 'no-nonsense', 'hands-on', 'real',
  ],
} as const;

/** Words that give a headline a positive or negative charge. */
export const SENTIMENT_WORDS = {
  bn: [
    'সেরা', 'চমৎকার', 'দারুণ', 'সফল', 'নিখুঁত', 'উপকারী', 'সহজ', 'স্মার্ট',
    'ভুল', 'খারাপ', 'বিপজ্জনক', 'ঝুঁকি', 'সমস্যা', 'ক্ষতি', 'এড়ান', 'বন্ধ',
    'কঠিন', 'বিরক্তিকর', 'অপচয়',
  ],
  en: [
    'best', 'great', 'excellent', 'perfect', 'brilliant', 'smart', 'better',
    'worst', 'bad', 'wrong', 'mistake', 'mistakes', 'avoid', 'dangerous',
    'risky', 'painful', 'stop', 'never', 'stuck', 'waste',
  ],
} as const;

/** Latin-script words need boundaries; Bengali is matched as a substring. */
function hit(haystack: string, term: string): boolean {
  if (/^[\x20-\x7e]+$/.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(haystack);
  }

  return haystack.includes(term);
}

/** The first matching term, or null. Case-insensitive for Latin script. */
export function findWord(text: string, list: { bn: readonly string[]; en: readonly string[] }) {
  const haystack = text.toLowerCase();

  return [...list.bn, ...list.en].find((term) => hit(haystack, term.toLowerCase())) ?? null;
}
