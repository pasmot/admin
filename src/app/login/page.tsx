import type { Metadata } from 'next';
import { LoginView } from '../../views/LoginView';

export const metadata: Metadata = { title: 'Masuk' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return <LoginView expired={expired === '1'} />;
}
