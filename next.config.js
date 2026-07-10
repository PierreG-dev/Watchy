/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['mongodb', 'nodemailer'],
  },
};

module.exports = nextConfig;
