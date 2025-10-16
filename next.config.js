/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
      outputFileTracingRoot: join(__dirname, '../../'),
  },
};

module.exports = nextConfig;