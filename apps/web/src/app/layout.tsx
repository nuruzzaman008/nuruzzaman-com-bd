import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';

import { SkipLink } from '@/components/layout/skip-link';
import { publicEnv } from '@/lib/env';
import { brand } from '@/lib/site';

import './globals.css';

/**
 * Fonts are self-hosted by next/font, so there is no blocking request to a
 * third-party font host and no layout shift while a face loads.
 */
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-bengali',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: `${brand.owner} — প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং শিক্ষা ও টুলস`,
    template: `%s — ${brand.owner}`,
  },
  description: brand.heroSupport,
  applicationName: 'nuruzzaman.com.bd',
  authors: [{ name: brand.owner }],
  creator: brand.owner,
  publisher: brand.owner,
  formatDetection: { telephone: false },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#0b1f33',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" dir="ltr" className={`${bengali.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
