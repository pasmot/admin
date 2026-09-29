/**
 * Logo PasarMotor, sama dengan web: versi putih untuk latar gelap (sidebar,
 * login — seperti footer web) dan versi utama untuk latar terang (header web).
 */
export function Wordmark({ tone = 'dark', size = 'md' }: { tone?: 'dark' | 'light'; size?: 'md' | 'lg' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`wordmark${size === 'lg' ? ' wordmark-lg' : ''}`}
      src={tone === 'dark' ? '/brand/pm-logo-horizontal-white.svg' : '/pm-logo-horizontal.svg'}
      alt="PasarMotor"
    />
  );
}
