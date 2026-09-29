import type { Metadata } from 'next';
import { UsersView } from '../../../views/UsersView';

export const metadata: Metadata = { title: 'Pengguna' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <UsersView initialFilter={filter} />;
}
