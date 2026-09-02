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
import { brand, supportNav } from '@/lib/site';

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

export default async function HomePage() {
  // Fetched in parallel so one slow query does not serialise the whole render.
  const [posts, courses, products, settings] = await Promise.all([
    publicApi<{ data: PostSummary[] }>('/posts', {
      query: { per_page: 3 },
      tags: ['posts'],
    }),
    tryPublicApi<{ data: CourseSummary[] }>('/courses', {
      query: { per_page: 3 },
      tags: ['courses'],
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
              {brand.statement}
            </h1>
            <p className="mt-5 text-lg text-white/80">{brand.heroSupport}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/engineering-tools" size="lg" variant="accent">
                NB Engineering Tools দেখুন
              </ButtonLink>
              <ButtonLink href="/blog" size="lg" variant="inverse">
                আর্টিকেল পড়ুন
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
                <strong className="block font-semibold text-navy">ইঞ্জিনিয়ার-রিভিউ করা লেখা</strong>
                <span className="text-muted">ইউনিট, অ্যাজাম্পশন ও কোড এডিশন উল্লেখ করে</span>
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
                    ? `পরীক্ষিত: ${site.product.tested_autocad_versions}`
                    : 'Windows 10 / 11, 64-bit'}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-amber" />
              <span>
                <strong className="block font-semibold text-navy">সুরক্ষিত ডাউনলোড</strong>
                <span className="text-muted">SHA-256 চেকসাম ও অ্যাকাউন্ট-ভিত্তিক অ্যাক্সেস</span>
              </span>
            </li>
          </ul>
        </Container>
      </div>

      <Section tone="white">
        <Container>
          <SectionHeading
            eyebrow="সর্বশেষ"
            title="ব্লগ থেকে"
            description="প্রতিটি লেখায় একটি বাস্তব উদাহরণ, ব্যবহৃত অ্যাজাম্পশন এবং সীমাবদ্ধতা স্পষ্ট করে লেখা থাকে।"
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
              title="এখনো কোনো আর্টিকেল প্রকাশ হয়নি"
              description="ইঞ্জিনিয়ার-রিভিউ শেষ হলে লেখা এখানে দেখা যাবে।"
            />
          )}

          <div className="mt-8">
            <ButtonLink href="/blog" variant="secondary">
              সব আর্টিকেল
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container>
          <SectionHeading
            eyebrow="NB Engineering Tools"
            title="AutoCAD-এর জন্য স্ট্রাকচারাল ও ইঞ্জিনিয়ারিং টুলসেট"
            description="২৬টি compiled VLX application, সাতটি feature group-এ সাজানো। Ribbon এবং classic pull-down menu — দুইভাবেই কাজ করে।"
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
              <strong>সামঞ্জস্য:</strong> মালিকের প্রকাশিত নথি অনুযায়ী বর্তমান
              commercial build {site?.product?.designed_for ?? 'AutoCAD 2024'}, Windows
              10/11 64-bit-এর জন্য প্রস্তুত।{' '}
              {site?.product?.tested_autocad_versions
                ? `রানটাইম-টেস্ট করা: ${site.product.tested_autocad_versions}।`
                : 'ভিন্ন ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে।'}
            </p>
            <p className="mt-2">
              সফটওয়্যারটি একটি productivity aid। চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব যোগ্য
              ব্যবহারকারীর।
            </p>
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
            <ButtonLink href="/engineering-tools">টুলস সম্পর্কে বিস্তারিত</ButtonLink>
            <ButtonLink href="/shop" variant="secondary">
              সব প্রোডাক্ট
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <Section tone="white">
        <Container>
          <SectionHeading
            eyebrow="কোর্স"
            title="বাংলায় প্র্যাকটিক্যাল কোর্স"
            description="হিসাব থেকে ড্রয়িং পর্যন্ত — প্রতিটি ধাপে ইউনিট, অ্যাজাম্পশন ও যাচাইয়ের পদ্ধতি সহ।"
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
              title="কোর্স এখনো প্রকাশিত হয়নি"
              description="প্রথম কোর্সগুলো তৈরি হচ্ছে। প্রকৃত লেসন যুক্ত না হওয়া পর্যন্ত কোনো কোর্স তালিকাভুক্ত করা হয় না।"
              action={
                <ButtonLink href="/blog" variant="secondary">
                  ততক্ষণে ব্লগ পড়ুন
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
              eyebrow="সহায়তা"
              title="ইনস্টলেশন থেকে অ্যাক্টিভেশন — ধাপে ধাপে"
              description="সবচেয়ে বেশি দরকার হয় এমন সহায়তা পাতাগুলো এক জায়গায়।"
            />

            <ul className="grid gap-3 sm:grid-cols-2">
              {supportNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded-[--radius-card] border border-blue/20 bg-white px-4 py-3 text-sm font-semibold text-navy hover:border-blue hover:text-blue"
                  >
                    {item.label}
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
