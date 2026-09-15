/**
 * Shapes and labels shared by the customer's affiliate page and the admin
 * screens. Money is in poisha, as everywhere else in the API.
 */

export const POISHA_PER_TAKA = 100;

export const PAYOUT_METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'other'] as const;

export type AffiliateStats = {
  visits: number;
  orders: number;
  earned_minor: number;
  pending_minor: number;
  available_minor: number;
  paid_minor: number;
  balance_minor: number;
};

export type CommissionState = 'pending' | 'available' | 'void';

export type AffiliateCommission = {
  id: number;
  state: CommissionState;
  currency: string;
  base_minor: number;
  rate: number;
  amount_minor: number;
  items: string[];
  created_at: string | null;
  available_at: string | null;
  void_reason: string | null;
  // Staff only.
  order_number?: string | null;
  order_status?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
};

export type AffiliatePayout = {
  id: number;
  amount_minor: number;
  currency: string;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string | null;
  // Staff only.
  recorded_by?: string | null;
};

export type AffiliateSettings = {
  enabled: boolean;
  default_rate: number;
  cookie_days: number;
  hold_days: number;
  min_payout_minor: number;
};

export type AffiliateMembership = {
  code: string;
  status: 'active' | 'suspended';
  rate: number;
  payout_method: string | null;
  payout_account: string | null;
  payout_name: string | null;
  joined_at: string | null;
  stats: AffiliateStats;
  commissions: AffiliateCommission[];
  payouts: AffiliatePayout[];
};

export type AffiliateAccount = {
  program: AffiliateSettings & { currency: string; payout_methods: string[] };
  affiliate: AffiliateMembership | null;
};

export type AdminAffiliateRow = {
  id: number;
  code: string;
  status: 'active' | 'suspended';
  /** The affiliate's own rate; null follows the program default. */
  commission_rate: number | null;
  rate: number;
  user: { id: number; name: string; email: string } | null;
  joined_at: string | null;
  stats: AffiliateStats;
};

export type AdminAffiliateDetail = AdminAffiliateRow & {
  phone: string | null;
  payout_method: string | null;
  payout_account: string | null;
  payout_name: string | null;
  admin_note: string | null;
  commissions: AffiliateCommission[];
  payouts: AffiliatePayout[];
  settings: AffiliateSettings;
};

export function payoutMethodLabel(method: string | null | undefined, bn: boolean): string {
  switch (method) {
    case 'bkash':
      return 'bKash';
    case 'nagad':
      return 'Nagad';
    case 'rocket':
      return 'Rocket';
    case 'bank':
      return bn ? 'ব্যাংক' : 'Bank';
    case 'other':
      return bn ? 'অন্যান্য' : 'Other';
    default:
      return '—';
  }
}

export const COMMISSION_TONE: Record<CommissionState, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  available: 'success',
  void: 'danger',
};

export function commissionStateLabel(state: CommissionState, bn: boolean): string {
  if (state === 'pending') return bn ? 'হোল্ডে আছে' : 'On hold';
  if (state === 'available') return bn ? 'প্রদেয়' : 'Payable';

  return bn ? 'বাতিল' : 'Void';
}

/** "12.5%" in the reader's digits. */
export function percent(rate: number, bn: boolean): string {
  return `${rate.toLocaleString(bn ? 'bn-BD' : 'en-US', { maximumFractionDigits: 2 })}%`;
}
