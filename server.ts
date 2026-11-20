import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeFoodImage,
  analyzeFoodText,
  UpstreamApiError,
  ValidationError,
} from './server/analyzeFood.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nutriscan-ai' });
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
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriScan AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
