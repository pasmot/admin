import type { Metadata } from 'next';
import { TransactionsView } from '../../../views/TransactionsView';

export const metadata: Metadata = { title: 'Transaksi' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <TransactionsView initialFilter={filter} />;
}
