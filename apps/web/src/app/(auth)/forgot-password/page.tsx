import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/features/auth/password-forms';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('পাসওয়ার্ড রিসেট');

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">পাসওয়ার্ড রিসেট</h1>
      <p className="mt-2 text-sm text-muted">
        আপনার ইমেইল দিন। ইমেইলটি নিবন্ধিত থাকলে একটি রিসেট লিংক পাঠানো হবে।
      </p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-blue hover:underline">
          সাইন ইনে ফিরুন
        </Link>
      </p>
    </>
  );
}
