import type { Metadata } from 'next';
import Link from 'next/link';

import { RegisterForm } from '@/features/auth/register-form';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.auth.registerTitle);
}

export default async function RegisterPage() {
  const { t } = await adminDictionary();

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">{t.auth.registerTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.auth.registerIntro}</p>

      <div className="mt-6">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t.auth.haveAccount}{' '}
        <Link href="/login" className="font-semibold text-blue hover:underline">
          {t.auth.signInTitle}
        </Link>
      </p>
    </>
  );
}
