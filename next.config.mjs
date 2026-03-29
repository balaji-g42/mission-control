/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  webpack: (config, { isServer }) => {
    // Externalize Node.js built-in modules for server builds
    if (isServer) {
      config.externals.push({
        'better-sqlite3': 'commonjs better-sqlite3',
        '@aws-sdk/client-s3': 'commonjs @aws-sdk/client-s3',
        'node:crypto': 'commonjs node:crypto',
        'node:fs': 'commonjs node:fs',
        'node:path': 'commonjs node:path',
        'node:os': 'commonjs node:os',
        'crypto': 'commonjs crypto',
        'fs': 'commonjs fs',
        'path': 'commonjs path',
        'os': 'commonjs os',
      });
    } else {
      // For client builds, provide empty shims for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
