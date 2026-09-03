/**
 * Bengali labels for the status values the API returns.
 *
 * The API sends the machine value (`fulfilled`, `in_review`), which is right for
 * a contract but wrong to show a reader: a Bengali page that suddenly prints an
 * English enum name reads as a bug. Every status the customer can actually see
 * is translated here, and anything unmapped falls back to the raw value rather
 * than to an empty badge.
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'খসড়া',
  pending_payment: 'পেমেন্টের অপেক্ষায়',
  paid: 'পরিশোধিত',
  fulfilled: 'সম্পন্ন',
  failed: 'ব্যর্থ',
  cancelled: 'বাতিল',
  refund_pending: 'রিফান্ড প্রক্রিয়াধীন',
  partially_refunded: 'আংশিক রিফান্ড',
  refunded: 'রিফান্ড হয়েছে',
};

export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: 'চলছে',
  completed: 'সম্পন্ন',
  expired: 'মেয়াদ শেষ',
  revoked: 'বাতিল',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'খোলা',
  pending: 'অপেক্ষমাণ',
  resolved: 'সমাধান হয়েছে',
  closed: 'বন্ধ',
};

export const ACTIVATION_STATUS_LABELS: Record<string, string> = {
  submitted: 'জমা হয়েছে',
  in_review: 'যাচাই চলছে',
  approved: 'অনুমোদিত',
  rejected: 'প্রত্যাখ্যাত',
  cancelled: 'বাতিল',
};

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft: 'খসড়া',
  in_review: 'রিভিউয়ে',
  scheduled: 'নির্ধারিত',
  published: 'প্রকাশিত',
  archived: 'সংরক্ষিত',
};

/** Looks a status up, falling back to the raw value so nothing renders blank. */
export function label(map: Record<string, string>, status: string | null | undefined): string {
  if (!status) {
    return '';
  }

  return map[status] ?? status;
}
