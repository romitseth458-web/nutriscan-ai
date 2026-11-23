import type { IncomingMessage, ServerResponse } from 'http';
import { UpstreamApiError, ValidationError } from '../server/analyzeFood.ts';
import {
  generateFullIndianMealPlan,
  regenerateSingleMealSlot,
  replaceMealFoodItem,
} from '../server/mealPlanner.ts';

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
  if (!raw) return {};
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
    const action = typeof body.action === 'string' ? body.action : 'generate_plan';

    if (action === 'generate_plan') {
      const plan = await generateFullIndianMealPlan(body.input);
      res.status(200).json({ plan });
      return;
    }

    if (action === 'regenerate_meal') {
      const meal = await regenerateSingleMealSlot({
        input: body.input,
        slotId: body.slotId,
        targetSlotCalories: body.targetSlotCalories,
        currentMealTitle: body.currentMealTitle,
      });
      res.status(200).json({ meal });
      return;
    }

    if (action === 'replace_item') {
      const item = await replaceMealFoodItem({
        input: body.input,
        slotId: body.slotId,
        currentItemName: body.currentItemName,
        targetCalories: body.targetCalories,
        preferredReplacement: body.preferredReplacement,
      });
      res.status(200).json({ item });
      return;
    }

    res.status(400).json({ error: `Unsupported meal-plan action: ${action}` });
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
