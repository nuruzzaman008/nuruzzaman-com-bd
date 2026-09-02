import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function NotFound() {
  return (
    <main id="main" className="flex-1">
      <Container size="narrow" className="py-24 text-center">
        <p className="font-latin text-sm font-semibold tracking-[0.18em] text-teal uppercase">404</p>
        <h1 className="mt-2 text-[length:var(--step-h1)] font-bold text-navy">
          পাতাটি খুঁজে পাওয়া যায়নি
        </h1>
        <p className="mt-3 text-muted">
          লিংকটি পুরোনো হতে পারে, অথবা কনটেন্টটি সরিয়ে নেওয়া হয়েছে।
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">হোমে ফিরুন</ButtonLink>
          <ButtonLink href="/blog" variant="secondary">
            ব্লগ দেখুন
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
