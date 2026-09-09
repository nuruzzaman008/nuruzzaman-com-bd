import { ManualPayments } from '@/features/dashboard/manual-payments';
import { privateMetadata } from '@/lib/seo';
export const metadata = privateMetadata('Payment verification');
export default function PaymentsPage() { return <ManualPayments />; }
