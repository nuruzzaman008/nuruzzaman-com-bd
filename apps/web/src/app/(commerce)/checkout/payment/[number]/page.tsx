import { PaymentSelection } from '@/features/commerce/payment-selection';
import { Container } from '@/components/ui/container';
import { privateMetadata } from '@/lib/seo';
export const metadata = privateMetadata('Payment');
export default async function PaymentPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <Container className="py-12"><h1 className="mb-8 text-3xl font-bold">Payment / পেমেন্ট</h1><PaymentSelection number={number} /></Container>;
}
