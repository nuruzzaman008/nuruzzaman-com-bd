import Link from 'next/link';

import { Container } from '@/components/ui/container';
import { brand } from '@/lib/site';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex flex-1 items-center bg-surface py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md">
          <Link href="/" className="flex items-center gap-2 text-navy hover:text-blue">
            <span
              aria-hidden="true"
              className="font-latin grid size-9 place-items-center rounded-lg bg-navy text-sm font-bold text-white"
            >
              NB
            </span>
            <span className="text-sm font-bold">{brand.owner}</span>
          </Link>

          <div className="mt-6 rounded-[--radius-card] border border-line bg-white p-6 shadow-[--shadow-card] sm:p-8">
            {children}
          </div>
        </div>
      </Container>
    </main>
  );
}
