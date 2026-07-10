/* Watchy custom server — wraps Next.js so we can control the HTTP server.
 * The backup scheduler is started by Next's instrumentation.ts hook, so
 * this file stays pure JavaScript with no TypeScript resolution concerns.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const http = require('node:http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res).catch((err) => {
        console.error('[watchy] request handler error:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      });
    });

    server.listen(port, hostname, () => {
      console.log(`[watchy] ready on http://${hostname}:${port} (dev=${dev})`);
    });

    const shutdown = (sig) => {
      console.log(`[watchy] ${sig} received, shutting down`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('[watchy] failed to start:', err);
    process.exit(1);
  });
