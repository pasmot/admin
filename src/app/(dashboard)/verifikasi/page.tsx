import type { Metadata } from 'next';
import { VerificationsView } from '../../../views/VerificationsView';

export const metadata: Metadata = { title: 'Verifikasi' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <VerificationsView initialFilter={filter} />;
}
