import Image from 'next/image';
import Link from 'next/link';
import type { ProductSummary } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PriceTag } from '@/components/ui/price';

const TYPE_LABELS: Record<string, string> = {
  software_license: 'সফটওয়্যার লাইসেন্স',
  credit_refill: 'ক্রেডিট রিফিল',
  course: 'কোর্স',
  bundle: 'বান্ডেল',
  digital_resource: 'ডিজিটাল রিসোর্স',
};

export function ProductCard({ product }: { product: ProductSummary }) {
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
        <Badge tone="warning">{TYPE_LABELS[product.type] ?? product.type}</Badge>

        <h3 className="mt-3 text-lg leading-snug font-bold text-navy">
          <Link
            href={`/shop/${product.slug}`}
            className="after:absolute after:inset-0 hover:text-blue"
          >
            {product.name}
          </Link>
        </h3>

        {product.tagline ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{product.tagline}</p>
        ) : null}

        <div className="mt-auto pt-4">
          {/* Null price renders as "contact for price", never as zero. */}
          <PriceTag value={product.from_price ?? null} size="sm" />
        </div>
      </div>
    </Card>
  );
}
