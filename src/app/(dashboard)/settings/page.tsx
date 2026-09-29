import type { Metadata } from 'next';
import { SettingsView } from '../../../views/SettingsView';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <SettingsView initialFilter={filter} />;
}
