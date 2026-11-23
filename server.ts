import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeFoodImage,
  analyzeFoodText,
  UpstreamApiError,
  ValidationError,
} from './server/analyzeFood.ts';
import { setupLiveDietAssistantWebSocket } from './server/liveDietAssistant.ts';
import { createLiveEphemeralToken, LiveTokenError } from './server/liveToken.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'rosofood-ai' });
});

app.post('/api/live-token', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
    const bodyToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    const idToken = bearerToken || bodyToken;

    const result = await createLiveEphemeralToken({
      idToken,
      context: req.body?.context,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof LiveTokenError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType, clarification } = req.body ?? {};

    if (typeof imageBase64 !== 'string' || typeof mimeType !== 'string') {
      res.status(400).json({
        error: 'Request must include imageBase64 and mimeType.',
      });
      return;
    }

    const result = await analyzeFoodImage({
      imageBase64,
      mimeType,
      clarification: typeof clarification === 'string' ? clarification : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof UpstreamApiError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/analyze-text', async (req, res) => {
  try {
    const { query } = req.body ?? {};
    if (typeof query !== 'string') {
      res.status(400).json({ error: 'Request must include a food or fruit query string.' });
      return;
    }

    const result = await analyzeFoodText(query);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof UpstreamApiError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);
  setupLiveDietAssistantWebSocket(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    app.get(['/dev-sw.js', '/sw.js'], (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
`);
    });

    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/') && req.headers.accept?.includes('text/html')) {
        res.setHeader('Cache-Control', 'no-store');
      }
      next();
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`RosoFood AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
