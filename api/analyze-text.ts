import type { IncomingMessage, ServerResponse } from 'http';
import { analyzeFoodText, UpstreamApiError, ValidationError } from '../server/analyzeFood.ts';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
  method?: string;
}

interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (data: unknown) => void;
}

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      throw new ValidationError('Invalid JSON request body.', 400);
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new ValidationError('Invalid JSON request body.', 400);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { query } = body;

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
}
