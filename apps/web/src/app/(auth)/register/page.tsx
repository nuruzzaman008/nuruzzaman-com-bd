import type { Metadata } from 'next';
import Link from 'next/link';

import { RegisterForm } from '@/features/auth/register-form';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অ্যাকাউন্ট তৈরি করুন');

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">অ্যাকাউন্ট তৈরি করুন</h1>
      <p className="mt-2 text-sm text-muted">
        একটি অ্যাকাউন্ট দিয়েই ডাউনলোড, কোর্স এবং অ্যাক্টিভেশন রিকোয়েস্ট — সব এক জায়গায়।
      </p>

      <div className="mt-6">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        আগে থেকেই অ্যাকাউন্ট আছে?{' '}
        <Link href="/login" className="font-semibold text-blue hover:underline">
          সাইন ইন
        </Link>
      </p>
    </>
  );
}
