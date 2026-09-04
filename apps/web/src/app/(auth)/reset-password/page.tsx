import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/features/auth/password-forms';
import { LoadingRegion } from '@/components/ui/states';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.auth.resetTitle);
}

export default async function ResetPasswordPage() {
  const { t } = await adminDictionary();

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">{t.auth.resetTitle}</h1>

      <div className="mt-6">
        <Suspense fallback={<LoadingRegion label={t.auth.formLoading} />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </>
  );
}
