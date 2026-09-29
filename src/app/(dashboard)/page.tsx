import type { Metadata } from 'next';
import { SummaryView } from '../../views/SummaryView';

export const metadata: Metadata = { title: 'Ringkasan' };

export default function Page() {
  return <SummaryView />;
}
