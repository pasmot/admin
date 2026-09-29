import type { Metadata } from 'next';
import { ReportsView } from '../../../views/ReportsView';

export const metadata: Metadata = { title: 'Masalah' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <ReportsView initialFilter={filter} />;
}
