import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/login-form';
import { LoadingRegion } from '@/components/ui/states';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.auth.signInTitle);
}

export default async function LoginPage() {
  const { t } = await adminDictionary();

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">{t.auth.signInTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.auth.signInIntro}</p>

      <div className="mt-6">
        {/* useSearchParams needs a Suspense boundary in the App Router. */}
        <Suspense fallback={<LoadingRegion label={t.auth.formLoading} />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t.auth.noAccount}{' '}
        <Link href="/register" className="font-semibold text-blue hover:underline">
          {t.auth.createOne}
        </Link>
      </p>
    </>
  );
}
