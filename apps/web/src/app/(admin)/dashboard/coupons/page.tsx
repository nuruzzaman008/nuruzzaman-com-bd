import type { Metadata } from 'next';

import { CouponManager } from '@/features/dashboard/coupon-manager';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.coupons);
}

export default async function DashboardCouponsPage() {
  const { t } = await adminDictionary();

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.coupons}</h1>

      <div className="mt-6">
        <CouponManager />
      </div>
    </div>
  );
}
