import type { Metadata } from 'next';
import type { SiteSettings } from '@nuruzzaman/contracts';

import { ContactForm } from '@/features/content/contact-form';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { tryPublicApi } from '@/lib/api/server';
import { buildMetadata } from '@/lib/seo';
import { navItemLabel, supportNav } from '@/lib/site';
import { localizePath } from '@/lib/i18n/locale';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';

export const metadata: Metadata = buildMetadata({
  title: 'যোগাযোগ',
  description: 'প্রশ্ন, সহায়তা বা মতামত — সরাসরি বার্তা পাঠান।',
  path: '/contact',
});

export default async function ContactPage({ locale }: LocalizedPageProps) {
  const { locale: active, t } = pageDictionary(locale);
  const settings = await tryPublicApi<{ data: SiteSettings }>('/site/settings', {
    tags: ['settings'],
  });

  const site = settings?.data ?? null;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: t.common.home, path: '/' },
          { name: t.contact.heading, path: '/contact' },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.contact.heading}</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {t.contact.intro}
          </p>

          <div className="mt-8 max-w-xl">
            <ContactForm />
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-navy">{t.contact.direct}</h2>
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
                  {t.contact.noDirectContact}
                </li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-navy">{t.contact.checkFirst}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {supportNav.map((item) => (
                <li key={item.href}>
                  <a
                    href={localizePath(item.href, active)}
                    className="text-blue hover:underline"
                  >
                    {navItemLabel(item, t)}
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <Callout tone="info">
            {t.contact.securityNotice}
          </Callout>
        </aside>
      </div>
    </Container>
  );
}
