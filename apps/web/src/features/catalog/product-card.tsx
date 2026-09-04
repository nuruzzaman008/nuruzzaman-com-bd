'use client';

import Image from 'next/image';
import type { ProductSummary } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/components/ui/locale-link';
import { PriceTag } from '@/components/ui/price';
import { productTypeLabel } from '@/lib/i18n/labels';
import { useLocale } from '@/lib/i18n/locale-provider';

export function ProductCard({ product }: { product: ProductSummary }) {
  const { t } = useLocale();

  return (
    <Card
      as="article"
      className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-[--shadow-raised] focus-within:shadow-[--shadow-raised]"
    >
      {product.cover_url ? (
        <Image
          src={product.cover_url}
          alt=""
          width={800}
          height={450}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[16/9] w-full bg-amber-soft" />
      )}

      <div className="flex flex-1 flex-col p-5">
        <Badge tone="warning">{productTypeLabel(t, product.type)}</Badge>

        <h3 data-authored="true" className="mt-3 text-lg leading-snug font-bold text-navy">
          <LocaleLink
            href={`/shop/${product.slug}`}
            className="after:absolute after:inset-0 hover:text-blue"
          >
            {product.name}
          </LocaleLink>
        </h3>

        {product.tagline ? (
          <p data-authored="true" className="mt-2 line-clamp-2 text-sm text-muted">
            {product.tagline}
          </p>
        ) : null}

        <div className="mt-auto pt-4">
          {/* A null price renders as a contact-for-price line, never as zero. */}
          <PriceTag value={product.from_price ?? null} size="sm" />
        </div>
      </div>
    </Card>
  );
}
