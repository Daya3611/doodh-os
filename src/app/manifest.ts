import { MetadataRoute } from 'next';

// This forces Next.js to pre-render the manifest for your static export (.exe)
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DoodhOS Milk Collection Center',
    short_name: 'DoodhOS',
    description: 'A modern SaaS platform for dairy collection centers to manage farmers, milk collections, and payments.',
    start_url: '/login',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#FF6B00',
    icons: [
      {
        src: '/logo.png',
        sizes: '2000x2000',
        type: 'image/png',
      },
      // {
      //   src: '/logo.svg',
      //   sizes: 'any',
      //   type: 'image/svg+xml',
      // }
    ],
  };
}
