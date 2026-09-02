import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/features/auth/password-forms';
import { LoadingRegion } from '@/components/ui/states';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('নতুন পাসওয়ার্ড');

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">নতুন পাসওয়ার্ড</h1>

      <div className="mt-6">
        <Suspense fallback={<LoadingRegion label="ফর্ম লোড হচ্ছে" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </>
  );
}
