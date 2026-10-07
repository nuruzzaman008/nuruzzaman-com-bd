import { privateMetadata } from '@/lib/seo';
import { WalletManagement } from '@/features/dashboard/wallet-management';

export const metadata = privateMetadata('Wallet Management');

export default function WalletsPage() {
  return <WalletManagement />;
}
