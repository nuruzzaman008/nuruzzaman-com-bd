import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/login-form';
import { LoadingRegion } from '@/components/ui/states';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('সাইন ইন');

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">সাইন ইন</h1>
      <p className="mt-2 text-sm text-muted">
        অর্ডার, ডাউনলোড ও কোর্স অ্যাক্সেস দেখতে সাইন ইন করুন।
      </p>

      <div className="mt-6">
        {/* useSearchParams needs a Suspense boundary in the App Router. */}
        <Suspense fallback={<LoadingRegion label="ফর্ম লোড হচ্ছে" />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        অ্যাকাউন্ট নেই?{' '}
        <Link href="/register" className="font-semibold text-blue hover:underline">
          তৈরি করুন
        </Link>
      </p>
    </>
  );
}
