
import type {NextConfig} from 'next';

const baseNextConfig: NextConfig = {
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

let configToExport = baseNextConfig;

// Apply PWA configuration only if:
// 1. It's a production environment (NODE_ENV === 'production')
// 2. Turbopack is NOT being used (!process.env.TURBOPACK)
if (process.env.NODE_ENV === 'production' && !process.env.TURBOPACK) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const withPWA = require('next-pwa')({
      dest: 'public',
      register: true,
      skipWaiting: true,
      publicExcludes: ['!noprecache/**/*', '!api/**/*'],
    });
    configToExport = withPWA(baseNextConfig);
  } catch (error) {
    console.warn("Failed to load or apply next-pwa configuration. Proceeding without PWA features.", error);
    // Fallback to base config if there's an issue with PWA setup
    configToExport = baseNextConfig;
  }
}
// If Turbopack is active (process.env.TURBOPACK is true),
// or if it's a development environment (process.env.NODE_ENV === 'development'),
// configToExport will remain baseNextConfig, and next-pwa is not required or applied.

export default configToExport;
