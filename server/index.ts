import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { join } from 'node:path';
import { dayRouter } from './routes/day.ts';
import { packsRouter } from './routes/packs.ts';

const DEFAULT_PORT = 8080;
const JSON_LIMIT = '10kb';
const root = join(import.meta.dirname, '..');
const dev = process.argv.includes('--dev');

const app = express();
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    // Practice screens must never be shown inside another site's page.
    'X-Frame-Options': 'DENY',
  });
  next();
});

app.use('/api', express.json({ limit: JSON_LIMIT }), (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', packsRouter);
app.use('/api', dayRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

if (dev) {
  // One process in dev too: Vite runs as middleware, so there is no second port to proxy.
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: join(root, 'vite.config.ts'),
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(join(root, 'dist')));
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = Number(err?.status) >= 400 && Number(err?.status) < 500 ? Number(err.status) : 500;
  // Log the error type only. Request bodies never go to the logs.
  if (status === 500) console.error('server_error', err?.name);
  res.status(status).json({ error: status === 500 ? 'server_error' : 'bad_request' });
};
app.use(onError);

const port = Number(process.env.PORT) || DEFAULT_PORT;
app.listen(port, () => {
  console.log(`listening on http://localhost:${port}${dev ? ' (dev)' : ''}`);
});
