import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/features/auth/password-forms';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.auth.forgotTitle);
}

export default async function ForgotPasswordPage() {
  const { t } = await adminDictionary();

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">{t.auth.forgotTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.auth.forgotIntro}</p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-blue hover:underline">
          {t.auth.backToSignIn}
        </Link>
      </p>
    </>
  );
}
