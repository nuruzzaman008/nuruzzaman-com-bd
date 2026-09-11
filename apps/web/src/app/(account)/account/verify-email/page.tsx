import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyEmail } from '@/features/account/verify-email';
import { LoadingRegion } from '@/components/ui/states';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.account.verifyTitle);
}

export default async function VerifyEmailPage() {
  const { t } = await adminDictionary();

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.account.verifyTitle}</h1>

      <div className="mt-6 max-w-xl">
        {/* useSearchParams needs a Suspense boundary in the App Router. */}
        <Suspense fallback={<LoadingRegion label={t.account.verifyWorking} />}>
          <VerifyEmail />
        </Suspense>
      </div>
    </div>
  );
}
