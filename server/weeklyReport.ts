import { GoogleGenAI, ThinkingLevel, Type, type Schema } from '@google/genai';
import type {
  DailyNutritionGoals,
  MacroTotals,
  WeeklyDaySnapshot,
  WeeklyReportAiFeedback,
} from '../src/types/nutrition.ts';
import { UpstreamApiError, ValidationError } from './analyzeFood.ts';

const GEMINI_TIMEOUT_MS = 28_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ValidatedWeeklyReportInput {
  startDateKey: string;
  endDateKey: string;
  loggedMealDaysCount: number;
  totalMealsLogged: number;
  dailyAverageTotals: MacroTotals;
  dailyGoalsSnapshot: DailyNutritionGoals;
  dailyWaterGoalMl: number;
  averageWaterMl: number;
  totalWaterMl: number;
  days: WeeklyDaySnapshot[];
  dietaryPreference?: string;
  fitnessGoal?: string;
}

function round1(value: number): number {
  return Math.round((Number.isFinite(value) ? Math.max(0, value) : 0) * 10) / 10;
}

function roundInt(value: number): number {
  return Math.round(Number.isFinite(value) ? Math.max(0, value) : 0);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new UpstreamApiError(message, 504));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function parseJsonSafe<T>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new UpstreamApiError('Gemini returned an empty weekly report. Please retry.', 502);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new SyntaxError('Model output was not valid JSON.');
  }
}

interface ExtractedError {
  status?: number;
  apiStatus?: string;
  message: string;
}

function extractErrorDetails(error: unknown, fallbackMsg: string): ExtractedError {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  let status = errObj?.status ?? errObj?.statusCode;
  let apiStatus: string | undefined;
  let message = errObj?.message || fallbackMsg;

  try {
    const firstBrace = message.indexOf('{');
    if (firstBrace !== -1) {
      const parsedErr = JSON.parse(message.slice(firstBrace)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsedErr?.error) {
        if (typeof parsedErr.error.code === 'number' && !status) status = parsedErr.error.code;
        if (parsedErr.error.status) apiStatus = parsedErr.error.status;
        if (parsedErr.error.message) message = parsedErr.error.message;
      }
    }
  } catch {
    // Keep original message
  }

  if (!status) {
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) status = 429;
    else if (/503|UNAVAILABLE|overloaded|high demand/i.test(message)) status = 503;
    else if (/403|PERMISSION_DENIED/i.test(message)) status = 403;
    else if (/401|UNAUTHENTICATED/i.test(message)) status = 401;
    else if (/404|NOT_FOUND/i.test(message)) status = 404;
  }

  return { status, apiStatus, message };
}

function isRetryable(error: unknown, extracted: ExtractedError): boolean {
  if (error instanceof SyntaxError) return true;
  if (error instanceof UpstreamApiError && error.statusCode >= 500) return true;
  const s = extracted.status;
  return s === 500 || s === 502 || s === 503 || s === 504;
}

function throwMappedError(lastError: unknown, fallbackMessage: string): never {
  if (lastError instanceof ValidationError) throw lastError;
  const { status, apiStatus, message } = extractErrorDetails(lastError, fallbackMessage);

  if (status === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    throw new UpstreamApiError(
      'Gemini API rate limit or quota reached. Please wait a few seconds and retry.',
      429
    );
  }
  if (status === 503 || apiStatus === 'UNAVAILABLE') {
    throw new UpstreamApiError(
      'The AI weekly report service is temporarily busy. Please retry in a few seconds.',
      503
    );
  }
  if (status === 401 || status === 403 || apiStatus === 'PERMISSION_DENIED') {
    throw new UpstreamApiError(
      'Gemini API authentication failed. Please check GEMINI_API_KEY in Settings > Secrets.',
      403
    );
  }
  if (lastError instanceof UpstreamApiError) throw lastError;
  throw new UpstreamApiError(message, status && status >= 400 && status < 600 ? status : 502);
}

function sanitizeMacroTotals(raw: unknown): MacroTotals {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    caloriesKcal: Math.min(25000, roundInt(Number(obj.caloriesKcal))),
    proteinGrams: Math.min(2000, round1(Number(obj.proteinGrams))),
    carbsGrams: Math.min(5000, round1(Number(obj.carbsGrams))),
    fatGrams: Math.min(2000, round1(Number(obj.fatGrams))),
    fiberGrams: Math.min(1000, round1(Number(obj.fiberGrams))),
  };
}

function sanitizeGoals(raw: unknown): DailyNutritionGoals {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    caloriesKcal: Math.max(400, Math.min(15000, roundInt(Number(obj.caloriesKcal) || 2000))),
    proteinGrams: Math.max(1, Math.min(1000, roundInt(Number(obj.proteinGrams) || 90))),
    carbsGrams: Math.max(1, Math.min(2000, roundInt(Number(obj.carbsGrams) || 240))),
    fatGrams: Math.max(1, Math.min(1000, roundInt(Number(obj.fatGrams) || 65))),
    fiberGrams: Math.max(1, Math.min(500, roundInt(Number(obj.fiberGrams) || 30))),
  };
}

export function validateWeeklyReportInput(raw: unknown): ValidatedWeeklyReportInput {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Missing weekly nutrition data.', 400);
  }
  const obj = raw as Record<string, unknown>;

  const startDateKey = typeof obj.startDateKey === 'string' ? obj.startDateKey.trim() : '';
  const endDateKey = typeof obj.endDateKey === 'string' ? obj.endDateKey.trim() : '';

  if (!DATE_KEY_RE.test(startDateKey) || !DATE_KEY_RE.test(endDateKey)) {
    throw new ValidationError('Invalid week date range.', 400);
  }

  if (!Array.isArray(obj.days) || obj.days.length !== 7) {
    throw new ValidationError('Weekly report requires exactly 7 daily slots.', 400);
  }

  const days: WeeklyDaySnapshot[] = obj.days.map((d) => {
    const item = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    const dateKey = typeof item.dateKey === 'string' ? item.dateKey.trim() : '';
    if (!DATE_KEY_RE.test(dateKey)) {
      throw new ValidationError('Each day in the 7-day window must have a valid YYYY-MM-DD date.', 400);
    }
    const mealCount = Math.max(0, Math.min(100, roundInt(Number(item.mealCount))));
    const waterMl = Math.max(0, Math.min(20000, roundInt(Number(item.waterMl))));
    const macros = sanitizeMacroTotals(item);
    return {
      dateKey,
      mealCount,
      waterMl,
      ...(mealCount === 0
        ? { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
        : macros),
    };
  });

  const computedLoggedMealDays = days.filter((d) => d.mealCount > 0).length;
  const computedTotalMeals = days.reduce((sum, d) => sum + d.mealCount, 0);

  if (computedLoggedMealDays < 2) {
    throw new ValidationError(
      'Not enough food diary data to generate a weekly nutrition summary. Log meals on at least 2 days in this week.',
      400
    );
  }

  const dailyAverageTotals: MacroTotals = {
    caloriesKcal: Math.round(
      days.reduce((sum, d) => sum + d.caloriesKcal, 0) / computedLoggedMealDays
    ),
    proteinGrams: round1(days.reduce((sum, d) => sum + d.proteinGrams, 0) / computedLoggedMealDays),
    carbsGrams: round1(days.reduce((sum, d) => sum + d.carbsGrams, 0) / computedLoggedMealDays),
    fatGrams: round1(days.reduce((sum, d) => sum + d.fatGrams, 0) / computedLoggedMealDays),
    fiberGrams: round1(days.reduce((sum, d) => sum + d.fiberGrams, 0) / computedLoggedMealDays),
  };

  const dailyWaterGoalMl = Math.max(
    500,
    Math.min(10000, roundInt(Number(obj.dailyWaterGoalMl) || 2500))
  );
  const totalWaterMl = days.reduce((sum, d) => sum + d.waterMl, 0);
  const waterLoggedDays = days.filter((d) => d.waterMl > 0).length;
  const averageWaterMl = waterLoggedDays > 0 ? Math.round(totalWaterMl / waterLoggedDays) : 0;

  return {
    startDateKey,
    endDateKey,
    loggedMealDaysCount: computedLoggedMealDays,
    totalMealsLogged: computedTotalMeals,
    dailyAverageTotals,
    dailyGoalsSnapshot: sanitizeGoals(obj.dailyGoalsSnapshot),
    dailyWaterGoalMl,
    averageWaterMl,
    totalWaterMl,
    days,
    dietaryPreference:
      typeof obj.dietaryPreference === 'string'
        ? obj.dietaryPreference.trim().slice(0, 40)
        : undefined,
    fitnessGoal:
      typeof obj.fitnessGoal === 'string' ? obj.fitnessGoal.trim().slice(0, 40) : undefined,
  };
}

const weeklyReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    aiSummary: {
      type: Type.STRING,
      description:
        'Supportive, practical 2–3 sentence summary comparing estimated daily averages and hydration against saved goals, explicitly noting if some days had no logs.',
    },
    highlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 3 concise, encouraging observations grounded strictly in the logged numbers.',
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '2 to 4 gentle, practical Indian & everyday food or hydration ideas for the coming week.',
    },
    estimationDisclaimer: {
      type: Type.STRING,
      description:
        'Brief reminder that nutrition values are wellness estimates and not medical advice.',
    },
  },
  required: ['aiSummary', 'highlights', 'suggestions', 'estimationDisclaimer'],
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new UpstreamApiError(
      'Server Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
      500
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const WEEKLY_REPORT_SYSTEM_INSTRUCTION = `You are RosoFood AI's supportive Weekly Nutrition Coach.
Strict Guardrails:
1. Be encouraging, warm, practical, and grounded ONLY in the real logged numbers provided.
2. NEVER invent or assume meals on unlogged days (mealCount === 0). Explicitly mention when only part of the week was logged.
3. NEVER give medical advice, diagnose health conditions, prescribe supplements/medications, or recommend extreme/crash diets or dangerously low calories (<1200 kcal).
4. Label nutrition numbers as estimates and keep suggestions everyday and culturally natural (e.g., adding a katori of dal/curd, roasted chana, seasonal fruit, extra vegetables, balanced roti-sabzi portions, or steady water spacing).`;

export async function generateWeeklyNutritionReport(
  rawBody: unknown
): Promise<WeeklyReportAiFeedback> {
  const data = validateWeeklyReportInput(rawBody);

  const dayLines = data.days
    .map((d) =>
      d.mealCount > 0
        ? `- ${d.dateKey}: ${d.mealCount} meals | ~${d.caloriesKcal} kcal, P ${d.proteinGrams}g, C ${d.carbsGrams}g, F ${d.fatGrams}g, Fiber ${d.fiberGrams}g | Water ${d.waterMl} ml`
        : `- ${d.dateKey}: NO MEALS LOGGED | Water ${d.waterMl} ml`
    )
    .join('\n');

  const prompt = `Summarize this user's 7-day nutrition & hydration diary (${data.startDateKey} to ${data.endDateKey}) as JSON.

Data Completeness:
- Logged meal days: ${data.loggedMealDaysCount} out of 7 days (${data.totalMealsLogged} total meals logged)
- Do NOT fill or guess unlogged days.

Estimated Daily Average (across ${data.loggedMealDaysCount} logged meal days) vs User's Saved Targets:
- Calories: ~${data.dailyAverageTotals.caloriesKcal} kcal vs target ${data.dailyGoalsSnapshot.caloriesKcal} kcal
- Protein: ~${data.dailyAverageTotals.proteinGrams} g vs target ${data.dailyGoalsSnapshot.proteinGrams} g
- Carbs: ~${data.dailyAverageTotals.carbsGrams} g vs target ${data.dailyGoalsSnapshot.carbsGrams} g
- Fat: ~${data.dailyAverageTotals.fatGrams} g vs target ${data.dailyGoalsSnapshot.fatGrams} g
- Fiber: ~${data.dailyAverageTotals.fiberGrams} g vs target ${data.dailyGoalsSnapshot.fiberGrams} g

Hydration:
- Total logged water: ${data.totalWaterMl} ml
- Avg water on logged hydration days: ${data.averageWaterMl} ml vs daily goal ${data.dailyWaterGoalMl} ml
${data.dietaryPreference ? `- Dietary preference: ${data.dietaryPreference}\n` : ''}${data.fitnessGoal ? `- Goal context: ${data.fitnessGoal}\n` : ''}
7-Day Breakdown:
${dayLines}

Return concise aiSummary (max 900 chars), 2-3 highlights, 2-4 practical non-medical suggestions, and a short estimationDisclaimer.`;

  const ai = getAiClient();
  const candidates = [
    { model: 'gemini-4-hydrogen', thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    { model: 'gemini-3.1-flash-lite', thinkingConfig: undefined },
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: candidate.model,
          contents: prompt,
          config: {
            systemInstruction: WEEKLY_REPORT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: weeklyReportSchema,
            ...(candidate.thinkingConfig ? { thinkingConfig: candidate.thinkingConfig } : {}),
          },
        }),
        GEMINI_TIMEOUT_MS,
        'Weekly nutrition report generation timed out. Please try again.'
      );

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new UpstreamApiError('Gemini returned an empty weekly report. Please retry.', 502);
      }

      const parsed = parseJsonSafe<Partial<WeeklyReportAiFeedback>>(text);
      const aiSummary = String(parsed.aiSummary || '').trim().slice(0, 950);
      if (!aiSummary) {
        throw new UpstreamApiError('Weekly summary response was incomplete. Please retry.', 502);
      }

      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights
            .map((h) => String(h || '').trim().slice(0, 220))
            .filter(Boolean)
            .slice(0, 5)
        : [];

      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .map((s) => String(s || '').trim().slice(0, 240))
            .filter(Boolean)
            .slice(0, 5)
        : [];

      const estimationDisclaimer =
        String(parsed.estimationDisclaimer || '').trim().slice(0, 480) ||
        'Calorie, macro, and hydration figures are approximate estimates from your logged diary entries for wellness awareness—not medical advice.';

      return {
        aiSummary,
        highlights,
        suggestions,
        estimationDisclaimer,
      };
    } catch (error: unknown) {
      lastError = error;
      const extracted = extractErrorDetails(error, 'Weekly report generation failed.');
      if (
        extracted.status === 400 ||
        extracted.status === 401 ||
        extracted.status === 403 ||
        extracted.status === 404 ||
        extracted.status === 504 ||
        !isRetryable(error, extracted)
      ) {
        break;
      }
    }
  }

  throwMappedError(lastError, 'Unable to generate AI weekly nutrition report right now.');
}
