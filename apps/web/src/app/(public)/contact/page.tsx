import type { Metadata } from 'next';
import type { SiteSettings } from '@nuruzzaman/contracts';

import { ContactForm } from '@/features/content/contact-form';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { tryPublicApi } from '@/lib/api/server';
import { buildMetadata } from '@/lib/seo';
import { supportNav } from '@/lib/site';

export const metadata: Metadata = buildMetadata({
  title: 'যোগাযোগ',
  description: 'প্রশ্ন, সহায়তা বা মতামত — সরাসরি বার্তা পাঠান।',
  path: '/contact',
});

export default async function ContactPage() {
  const settings = await tryPublicApi<{ data: SiteSettings }>('/site/settings', {
    tags: ['settings'],
  });

  const site = settings?.data ?? null;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: 'হোম', path: '/' },
          { name: 'যোগাযোগ', path: '/contact' },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h1 className="text-[length:var(--step-h1)] font-bold text-navy">যোগাযোগ</h1>
          <p className="mt-3 max-w-2xl text-muted">
            অ্যাকাউন্ট থাকলে সাপোর্ট টিকিট খুললে সেটি আপনার অর্ডারের সঙ্গে যুক্ত থাকে এবং উত্তর
            দ্রুত হয়। অ্যাকাউন্ট ছাড়াও এই ফর্ম থেকে লিখতে পারেন।
          </p>

          <div className="mt-8 max-w-xl">
            <ContactForm />
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-navy">সরাসরি</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {site?.support_email ? (
                <li>
                  <a href={`mailto:${site.support_email}`} className="text-blue hover:underline">
                    {site.support_email}
                  </a>
                </li>
              ) : null}
              {site?.phone ? <li className="text-muted">{site.phone}</li> : null}
              {site?.support_hours ? (
                <li className="text-muted">{site.support_hours}</li>
              ) : null}
              {!site?.support_email && !site?.phone ? (
                <li className="text-muted">
                  সরাসরি যোগাযোগের তথ্য এখনো প্রকাশ করা হয়নি; এই ফর্মটি ব্যবহার করুন।
                </li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-navy">আগে দেখে নিন</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {supportNav.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-blue hover:underline">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <Callout tone="info">
            কার্ড নম্বর, পাসওয়ার্ড বা লাইসেন্স ফাইল কখনো ইমেইলে পাঠাবেন না। আমরা কখনো
            সেগুলো চাইব না।
          </Callout>
        </aside>
      </div>
    </Container>
  );
}
