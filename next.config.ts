import type {NextConfig} from 'next';

// PWA configuration
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require('next-pwa')({
  dest: 'public', // Destination directory for the PWA files (service worker, workbox)
  register: true, // Register the service worker
  skipWaiting: true, // Skip waiting for service worker activation
  disable: process.env.NODE_ENV === 'development', // Disable PWA in development for easier debugging
  publicExcludes: ['!noprecache/**/*', '!api/**/*'], // Exclude API routes and specific assets from being precached
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withPWA(nextConfig);
