import type { Metadata } from 'next';
import { InspectionsView } from '../../../views/InspectionsView';

export const metadata: Metadata = { title: 'Inspeksi' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <InspectionsView initialFilter={filter} />;
}
