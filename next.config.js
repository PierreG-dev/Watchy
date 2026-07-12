/** @type {import('next').NextConfig} */
const NODE_ONLY = ['mongodb', 'nodemailer', 'node-cron', 'check-disk-space'];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: NODE_ONLY,
  },
  webpack: (config, { isServer, nextRuntime }) => {
    // Instrumentation gets bundled for BOTH runtimes even when we guard with
    // `NEXT_RUNTIME !== 'nodejs'`. Force these node-only packages to stay
    // external in every server bundle so tracing doesn't try to resolve 'net'.
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      config.externals = [
        ...externals,
        ({ request }, callback) => {
          if (!request) return callback();
          if (NODE_ONLY.includes(request)) return callback(null, 'commonjs ' + request);
          // node:child_process, node:fs, etc. are not supported in edge — but
          // instrumentation is compiled for edge too. Externalise them so the
          // build succeeds; runtime guard prevents actually reaching them.
          if (request.startsWith('node:')) return callback(null, 'commonjs ' + request);
          callback();
        },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
