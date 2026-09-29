import type { Metadata } from 'next';
import { MoneyView } from '../../../views/MoneyView';

export const metadata: Metadata = { title: 'Uang' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <MoneyView initialFilter={filter} />;
}
