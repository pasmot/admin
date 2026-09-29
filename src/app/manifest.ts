import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PasarMotor Admin',
    short_name: 'PM Admin',
    description: 'Dashboard operasional PasarMotor.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#d92226',
    icons: [
      { src: '/brand/pm-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/pm-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
