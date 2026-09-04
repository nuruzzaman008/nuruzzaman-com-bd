'use client';

import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { useLocale } from '@/lib/i18n/locale-provider';

/*
  A client component so it reads in whichever language the URL was in. A 404
  is often the first page a visitor sees on a bad link, and answering it in
  the wrong language is a poor first impression.
*/
export default function NotFound() {
  const { t } = useLocale();

  return (
    <main id="main" className="flex-1">
      <Container size="narrow" className="py-24 text-center">
        <p className="font-latin text-sm font-semibold tracking-[0.18em] text-teal uppercase">404</p>
        <h1 className="mt-2 text-[length:var(--step-h1)] font-bold text-navy">
          {t.errors.notFoundTitle}
        </h1>
        <p className="mt-3 text-muted">
          {t.errors.notFoundBody}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">{t.errors.backHome}</ButtonLink>
          <ButtonLink href="/blog" variant="secondary">
            {t.errors.seeBlog}
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
