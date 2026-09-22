'use client';

import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

const COLOURS = [
  'bg-blue',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-700',
  'bg-indigo-600',
  'bg-teal-700',
];

/** The same person always gets the same colour. */
function colourFor(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;

  return COLOURS[Math.abs(hash) % COLOURS.length] as string;
}

const SIZES = {
  sm: {
    box: 'size-8',
    text: 'text-xs',
    px: 32,
    badge: 'size-4 -end-0.5 -bottom-0.5',
    icon: 'size-2.5',
  },
  md: {
    box: 'size-11',
    text: 'text-base',
    px: 44,
    badge: 'size-5 -end-1 -bottom-1',
    icon: 'size-3',
  },
  lg: {
    box: 'size-12',
    text: 'text-lg',
    px: 48,
    badge: 'size-6 -end-1 -bottom-1',
    icon: 'size-3.5',
  },
};

/**
 * A round photo, or the first letter on a colour when there is none (or it
 * fails to load), with an optional small badge in the corner saying what kind
 * of notification it is - the way Facebook shows a reaction on a face.
 */
export function PersonAvatar({
  name,
  src,
  size = 'md',
  badge,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: keyof typeof SIZES;
  badge?: { icon: LucideIcon; className: string } | null;
}) {
  const [broken, setBroken] = useState(false);
  const shape = SIZES[size];
  const label = (name ?? '').trim();
  const initial = Array.from(label)[0]?.toUpperCase() ?? '•';
  const BadgeIcon = badge?.icon;

  return (
    <span className={cn('relative inline-block shrink-0', shape.box)} aria-hidden="true">
      {src && !broken ? (
        <Image
          unoptimized
          src={src}
          alt=""
          width={shape.px}
          height={shape.px}
          onError={() => setBroken(true)}
          className={cn('rounded-full object-cover', shape.box)}
        />
      ) : (
        <span
          className={cn(
            'grid place-items-center rounded-full font-bold text-white',
            shape.box,
            shape.text,
            colourFor(label || '?'),
          )}
        >
          {initial}
        </span>
      )}
      {BadgeIcon ? (
        <span
          className={cn(
            'absolute grid place-items-center rounded-full text-white ring-2 ring-white',
            shape.badge,
            badge.className,
          )}
        >
          <BadgeIcon className={shape.icon} strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}
