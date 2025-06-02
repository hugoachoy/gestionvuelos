
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
    publicExcludes: ['!noprecache/**/*', '!api/**/*'], 
  });
  configToExport = withPWA(nextConfig);
}

export default configToExport;

