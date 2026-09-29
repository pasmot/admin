import type { Metadata } from 'next';
import { KiosView } from '../../../views/KiosView';

export const metadata: Metadata = { title: 'Kios' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <KiosView initialFilter={filter} />;
}
