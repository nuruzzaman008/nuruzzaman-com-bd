import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';

import { SkipLink } from '@/components/layout/skip-link';
import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { SessionProvider } from '@/lib/session/session-provider';
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
  alternates: {
    canonical: '/',
    // Lets feed readers and crawlers discover the article feed from any page.
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: brand.owner }] },
  },
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
        {/* Inside LocaleProvider: the skip link is the first thing a keyboard
            or screen-reader user meets, so it has to be in their language. */}
        <LocaleProvider>
          <SkipLink />
          {/* One `/me` and `/cart` request per page load, shared by the header
              and the footer's admin entrance. */}
          <SessionProvider>{children}</SessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
