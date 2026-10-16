import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { join } from 'node:path';
import { callRouter } from './routes/call.ts';
import { dayRouter } from './routes/day.ts';
import { labRouter } from './routes/lab.ts';
import { roomRouter } from './routes/room.ts';
import { lessonRouter } from './routes/lesson.ts';
import { packsRouter } from './routes/packs.ts';

const DEFAULT_PORT = 8080;
const JSON_LIMIT = '10kb';
const root = join(import.meta.dirname, '..');
const dev = process.argv.includes('--dev');

// A background mirror or a model client must never take the process down with it.
process.on('unhandledRejection', (reason) => console.error('unhandled_rejection', (reason as Error)?.name ?? 'unknown'));

const app = express();
app.disable('x-powered-by');
// Cloud Run's load balancer sets X-Forwarded-For; without this req.ip is the proxy
// and the lab's per-client limit becomes one limit for everyone.
app.set('trust proxy', true);

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
app.use('/api', lessonRouter);
app.use('/api', labRouter);
app.use('/api', roomRouter);
app.use('/api', callRouter);
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
