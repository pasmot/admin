import type { Metadata } from 'next';
import { VouchersView } from '../../../views/VouchersView';

export const metadata: Metadata = { title: 'Voucher' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <VouchersView initialFilter={filter} />;
}
