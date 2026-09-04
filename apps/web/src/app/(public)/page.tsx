import Link from 'next/link';
import type { Metadata } from 'next';
import type { CourseSummary, PostSummary, ProductSummary, SiteSettings } from '@nuruzzaman/contracts';

import { PostCard } from '@/features/content/post-card';
import { CourseCard } from '@/features/courses/course-card';
import { ProductCard } from '@/features/catalog/product-card';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Container, Section, SectionHeading } from '@/components/ui/container';
import { EmptyState } from '@/components/ui/states';
import { publicApi, tryPublicApi } from '@/lib/api/server';
import { buildMetadata, jsonLd, organizationSchema, personSchema, websiteSchema } from '@/lib/seo';
import { localizePath } from '@/lib/i18n/locale';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { brand, navItemLabel, supportNav } from '@/lib/site';

export const metadata: Metadata = buildMetadata({
  title: `${brand.owner} — প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং শিক্ষা ও টুলস`,
  description: brand.heroSupport,
  path: '/',
});

const FEATURE_GROUPS = [
  'Layout, Grid & Schedule',
  'Footing & Foundation',
  'Geotechnical',
  'Beam & Slab',
  'Mouza & OCR',
  'Dimension Utilities',
  'License & System',
];

export default async function HomePage({ locale }: LocalizedPageProps) {
  const { locale: active, t } = pageDictionary(locale);

  // Fetched in parallel so one slow query does not serialise the whole render.
  const [posts, courses, products, settings] = await Promise.all([
    publicApi<{ data: PostSummary[] }>('/posts', {
      query: { per_page: 3, locale: active },
      tags: ['posts', `posts:${active}`],
    }),
    tryPublicApi<{ data: CourseSummary[] }>('/courses', {
      query: { per_page: 3, locale: active },
      tags: ['courses', `courses:${active}`],
    }),
    tryPublicApi<{ data: ProductSummary[] }>('/products', {
      query: { per_page: 3 },
      tags: ['products'],
    }),
    tryPublicApi<{ data: SiteSettings }>('/site/settings', { tags: ['settings'] }),
  ]);

  const site = settings?.data ?? null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            websiteSchema(),
            organizationSchema({
              name: site?.name ?? brand.owner,
              support_email: site?.support_email,
              phone: site?.phone,
            }),
            personSchema({
              name: 'Engr. Md. Nuruzzaman',
              credentials: 'RSE',
              headline: 'Structural engineer and AutoCAD automation developer',
            }),
          ]),
        }}
      />

      <Section tone="navy" className="py-16 sm:py-24">
        <Container>
          <div className="max-w-3xl">
            <p className="font-latin text-xs font-semibold tracking-[0.2em] text-amber uppercase">
              nuruzzaman.com.bd
            </p>
            <h1 className="mt-3 text-[length:var(--step-display)] leading-[1.15] font-bold text-white">
              {t.brand.statement}
            </h1>
            <p className="mt-5 text-lg text-white/80">{t.brand.heroSupport}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/engineering-tools" size="lg" variant="accent">
                {t.home.heroCtaTools}
              </ButtonLink>
              <ButtonLink href="/blog" size="lg" variant="inverse">
                {t.home.heroCtaBlog}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      <div className="border-b border-line bg-white">
        <Container className="py-6">
          <ul className="grid gap-4 text-sm sm:grid-cols-3">
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-teal" />
              <span>
                <strong className="block font-semibold text-navy">{t.home.trustReviewed}</strong>
                <span className="text-muted">{t.home.trustReviewedDetail}</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-blue" />
              <span>
                <strong className="block font-semibold text-navy">
                  {site?.product?.designed_for ?? 'AutoCAD 2024'}
                </strong>
                <span className="text-muted">
                  {/* Only claims a tested version once the owner has recorded one. */}
                  {site?.product?.tested_autocad_versions
                    ? `${t.home.trustTested}: ${site.product.tested_autocad_versions}`
                    : 'Windows 10 / 11, 64-bit'}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-amber" />
              <span>
                <strong className="block font-semibold text-navy">{t.home.trustDownload}</strong>
                <span className="text-muted">{t.home.trustDownloadDetail}</span>
              </span>
            </li>
          </ul>
        </Container>
      </div>

      <Section tone="white">
        <Container>
          <SectionHeading
            eyebrow={t.home.blogEyebrow}
            title={t.home.blogTitle}
            description={t.home.blogDescription}
          />

          {posts.data.length > 0 ? (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.data.map((post, index) => (
                <li key={post.slug} className="contents">
                  <PostCard post={post} priority={index === 0} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-8"
              title={t.home.blogEmptyTitle}
              description={t.home.blogEmptyDescription}
            />
          )}

          <div className="mt-8">
            <ButtonLink href="/blog" variant="secondary">
              {t.home.blogAll}
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container>
          <SectionHeading
            eyebrow="NB Engineering Tools"
            title={t.home.toolsTitle}
            description={t.home.toolsDescription}
          />

          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_GROUPS.map((group) => (
              <li
                key={group}
                className="font-latin rounded-[--radius-card] border border-line bg-white px-4 py-3 text-sm font-semibold text-navy"
              >
                {group}
              </li>
            ))}
          </ul>

          <Callout tone="warning" className="mt-6">
            <p>
              <strong>{t.home.compatibilityLabel}</strong> {t.home.compatibilityBody}{' '}
              {site?.product?.designed_for ?? 'AutoCAD 2024'}
              {t.home.compatibilitySuffix}{' '}
              {site?.product?.tested_autocad_versions
                ? `${t.home.compatibilityTested}: ${site.product.tested_autocad_versions}.`
                : t.home.compatibilityUntested}
            </p>
            <p className="mt-2">{t.home.productivityAid}</p>
          </Callout>

          {products && products.data.length > 0 ? (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.data.map((product) => (
                <li key={product.slug} className="contents">
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/engineering-tools">{t.home.toolsCta}</ButtonLink>
            <ButtonLink href="/shop" variant="secondary">
              {t.home.productsAll}
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <Section tone="white">
        <Container>
          <SectionHeading
            eyebrow={t.home.coursesEyebrow}
            title={t.home.coursesTitle}
            description={t.home.coursesDescription}
          />

          {courses && courses.data.length > 0 ? (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.data.map((course) => (
                <li key={course.slug} className="contents">
                  <CourseCard course={course} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-8"
              title={t.home.coursesEmptyTitle}
              description={t.home.coursesEmptyDescription}
              action={
                <ButtonLink href="/blog" variant="secondary">
                  {t.home.coursesEmptyCta}
                </ButtonLink>
              }
            />
          )}
        </Container>
      </Section>

      <Section tone="blue">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <SectionHeading
              eyebrow={t.home.supportEyebrow}
              title={t.home.supportTitle}
              description={t.home.supportDescription}
            />

            <ul className="grid gap-3 sm:grid-cols-2">
              {supportNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={localizePath(item.href, active)}
                    className="flex min-h-11 items-center rounded-[--radius-card] border border-blue/20 bg-white px-4 py-3 text-sm font-semibold text-navy hover:border-blue hover:text-blue"
                  >
                    {navItemLabel(item, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>
    </>
  );
}
