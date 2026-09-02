import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li';
}) {
  return (
    <As
      className={cn(
        'rounded-[--radius-card] border border-line bg-white shadow-[--shadow-card]',
        className,
      )}
    >
      {children}
    </As>
  );
}

/**
 * A card whose whole surface is clickable while only the title is a real link,
 * so the accessible name stays meaningful and keyboard focus lands once.
 */
export function LinkCard({
  href,
  title,
  children,
  className,
  footer,
}: {
  href: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <Card
      as="article"
      className={cn(
        'group relative flex flex-col transition-shadow hover:shadow-[--shadow-raised]',
        'focus-within:shadow-[--shadow-raised]',
        className,
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg leading-snug font-bold text-navy">
          <Link href={href} className="after:absolute after:inset-0 hover:text-blue">
            {title}
          </Link>
        </h3>
        {children}
      </div>
      {footer ? <div className="border-t border-line px-5 py-3 text-sm">{footer}</div> : null}
    </Card>
  );
}
