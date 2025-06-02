
import type {NextConfig} from 'next';

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

let configToExport: NextConfig = nextConfig;

if (process.env.NODE_ENV === 'production') {
  // PWA configuration only for production
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const withPWA = require('next-pwa')({
    dest: 'public', 
    register: true, 
    skipWaiting: true, 
    // 'disable' option is not strictly needed here as this code block only runs in production,
    // but 'next-pwa' itself might still check NODE_ENV if its internal 'disable' logic is aggressive.
    // For safety and to ensure it's active in production, we don't set 'disable' here.
    publicExcludes: ['!noprecache/**/*', '!api/**/*'], 
  });
  configToExport = withPWA(nextConfig);
}

export default configToExport;
