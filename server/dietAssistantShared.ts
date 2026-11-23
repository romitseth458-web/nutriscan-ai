import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Type, type FunctionDeclaration } from '@google/genai';
import type {
  DailyNutritionGoals,
  DietActivityLevel,
  DietaryPreference,
  DietFitnessGoal,
  UserDietProfile,
} from '../src/types/nutrition.ts';
import type { UserDietAssistantContext } from '../src/utils/dietContext.ts';

export const LIVE_MODEL = 'gemini-3.8-live';
export const LIVE_MODEL_RESOURCE = `models/${LIVE_MODEL}`;
export const DEFAULT_VOICE_NAME = 'Kore';

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CachedCerts {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let cachedCerts: CachedCerts | null = null;
let cachedProjectId: string | null = null;

export function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '../firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  for (const configPath of candidates) {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (parsed.projectId) {
        cachedProjectId = parsed.projectId;
        return cachedProjectId;
      }
    }
  }

  if (process.env.FIREBASE_PROJECT_ID) {
    cachedProjectId = process.env.FIREBASE_PROJECT_ID.trim();
    return cachedProjectId;
  }

  throw new Error('Firebase projectId is missing in firebase-applet-config.json.');
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && cachedCerts.expiresAtMs > now) {
    return cachedCerts.certs;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    throw new Error('Unable to fetch Firebase verification certificates.');
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = (await response.json()) as Record<string, string>;

  cachedCerts = {
    certs,
    expiresAtMs: now + Math.max(60, maxAgeSeconds) * 1000,
  };
  return certs;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 8192) {
    throw new Error('Missing or malformed Firebase authentication token.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Firebase ID token format.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: {
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as typeof payload;
  } catch {
    throw new Error('Unable to decode Firebase ID token.');
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Unsupported Firebase token signature algorithm.');
  }

  const projectId = getFirebaseProjectId();
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error('Firebase token audience mismatch.');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase token issuer mismatch.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new Error('Firebase token subject is invalid.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Firebase authentication session expired. Please refresh and try again.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) {
    throw new Error('Firebase token issued-at timestamp is invalid.');
  }

  let certs = await fetchGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await fetchGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error('Unable to match Firebase signing certificate.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signature = Buffer.from(signatureB64, 'base64url');
  const isValidSignature = verifier.verify(certPem, signature);
  if (!isValidSignature) {
    throw new Error('Firebase ID token signature verification failed.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: Boolean(payload.email_verified),
  };
}

const VALID_ACTIVITY = new Set<DietActivityLevel>(['sedentary', 'light', 'moderate', 'active']);
const VALID_GOALS = new Set<DietFitnessGoal>([
  'weight_loss',
  'weight_gain',
  'muscle_building',
  'maintenance',
]);
const VALID_DIET_PREFS = new Set<DietaryPreference>([
  'vegetarian',
  'non-vegetarian',
  'eggetarian',
  'vegan',
]);

export function sanitizeDietProfileArgs(args: Record<string, unknown>): UserDietProfile {
  const clean: UserDietProfile = {};
  const age = Number(args.age);
  if (Number.isFinite(age) && age >= 13 && age <= 100) {
    clean.age = Math.round(age);
  }
  const heightCm = Number(args.heightCm);
  if (Number.isFinite(heightCm) && heightCm >= 100 && heightCm <= 250) {
    clean.heightCm = Math.round(heightCm * 10) / 10;
  }
  const weightKg = Number(args.weightKg);
  if (Number.isFinite(weightKg) && weightKg >= 25 && weightKg <= 300) {
    clean.weightKg = Math.round(weightKg * 10) / 10;
  }
  if (
    typeof args.activityLevel === 'string' &&
    VALID_ACTIVITY.has(args.activityLevel as DietActivityLevel)
  ) {
    clean.activityLevel = args.activityLevel as DietActivityLevel;
  }
  if (typeof args.fitnessGoal === 'string' && VALID_GOALS.has(args.fitnessGoal as DietFitnessGoal)) {
    clean.fitnessGoal = args.fitnessGoal as DietFitnessGoal;
  }
  if (
    typeof args.dietaryPreference === 'string' &&
    VALID_DIET_PREFS.has(args.dietaryPreference as DietaryPreference)
  ) {
    clean.dietaryPreference = args.dietaryPreference as DietaryPreference;
  }
  return clean;
}

export function sanitizeDailyGoalsArgs(
  args: Record<string, unknown>,
  fallback: DailyNutritionGoals
): DailyNutritionGoals {
  const clamp = (val: unknown, min: number, max: number, def: number): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return def;
    return Math.round(Math.min(max, Math.max(min, n)));
  };

  return {
    // Enforce safe minimum daily calorie floor >= 1200 kcal
    caloriesKcal: clamp(args.caloriesKcal, 1200, 8000, Math.max(1200, fallback.caloriesKcal)),
    proteinGrams: clamp(args.proteinGrams, 30, 500, fallback.proteinGrams),
    carbsGrams: clamp(args.carbsGrams, 30, 1000, fallback.carbsGrams),
    fatGrams: clamp(args.fatGrams, 20, 400, fallback.fatGrams),
    fiberGrams: clamp(args.fiberGrams, 10, 150, fallback.fiberGrams),
  };
}

export function sanitizeContext(raw: unknown): UserDietAssistantContext {
  const fallbackGoals: DailyNutritionGoals = {
    caloriesKcal: 2000,
    proteinGrams: 120,
    carbsGrams: 225,
    fatGrams: 65,
    fiberGrams: 30,
  };

  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserDietAssistantContext>;
  const safeName = String(c.displayName || 'Friend').slice(0, 60);
  const todayDateKey = String(c.todayDateKey || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const selectedDateKey = String(c.selectedDateKey || todayDateKey).slice(0, 10);
  const preferredLanguage =
    c.preferredLanguage === 'english' ||
    c.preferredLanguage === 'hindi' ||
    c.preferredLanguage === 'hinglish'
      ? c.preferredLanguage
      : 'auto';

  const dailyGoals = c.dailyGoals
    ? {
        caloriesKcal: Math.round(Number(c.dailyGoals.caloriesKcal) || 2000),
        proteinGrams: Math.round(Number(c.dailyGoals.proteinGrams) || 120),
        carbsGrams: Math.round(Number(c.dailyGoals.carbsGrams) || 225),
        fatGrams: Math.round(Number(c.dailyGoals.fatGrams) || 65),
        fiberGrams: Math.round(Number(c.dailyGoals.fiberGrams) || 30),
      }
    : fallbackGoals;

  const dietProfile = sanitizeDietProfileArgs((c.dietProfile || {}) as Record<string, unknown>);
  const missingProfileFields: UserDietAssistantContext['missingProfileFields'] = [];
  if (typeof dietProfile.age !== 'number') missingProfileFields.push('age');
  if (typeof dietProfile.heightCm !== 'number') missingProfileFields.push('heightCm');
  if (typeof dietProfile.weightKg !== 'number') missingProfileFields.push('weightKg');
  if (!dietProfile.activityLevel) missingProfileFields.push('activityLevel');
  if (!dietProfile.fitnessGoal) missingProfileFields.push('fitnessGoal');

  const emptyDay = {
    dateKey: todayDateKey,
    mealCount: 0,
    totals: { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 },
    remainingToGoal: { ...dailyGoals },
    meals: [],
  };

  return {
    displayName: safeName,
    todayDateKey,
    selectedDateKey,
    preferredLanguage,
    dailyGoals,
    dietProfile,
    missingProfileFields,
    todaySummary: c.todaySummary || emptyDay,
    selectedDaySummary: c.selectedDaySummary || null,
    weeklySummary: c.weeklySummary || {
      windowStartDateKey: todayDateKey,
      windowEndDateKey: todayDateKey,
      daysLoggedCount: 0,
      totalMealsLogged: 0,
      averageCaloriesWhenLogged: 0,
      averageProteinWhenLogged: 0,
      averageCarbsWhenLogged: 0,
      averageFatWhenLogged: 0,
      averageFiberWhenLogged: 0,
      dailyBreakdown: [],
    },
  };
}

export function buildSystemInstruction(ctx: UserDietAssistantContext): string {
  const languageGuidance =
    ctx.preferredLanguage === 'hindi'
      ? 'Respond primarily in warm, natural everyday Hindi (Devanagari/Hinglish friendly as appropriate for voice pronunciation).'
      : ctx.preferredLanguage === 'hinglish'
        ? 'Respond primarily in natural conversational Hinglish (easy Hindi-English mix commonly spoken in India).'
        : ctx.preferredLanguage === 'english'
          ? 'Respond primarily in warm, clear conversational English.'
          : 'Automatically match the language the user speaks: fluently support English, Hindi, and Hinglish. Switch smoothly whenever the user switches.';

  return `You are "Roso", the warm, encouraging, knowledgeable Personal AI Diet Assistant for RosoFood AI.
You are speaking with ${ctx.displayName} in a live voice call.

LANGUAGE & VOICE STYLE:
- ${languageGuidance}
- Keep replies crisp, natural, and spoken-friendly (typically 2-5 concise sentences unless the user asks for a full daily meal plan).
- Never read out raw markdown characters, asterisks, hashtags, or JSON syntax aloud.

CORE DIET ASSISTANT CAPABILITIES:
- Help with daily calorie requirements, protein, carbohydrates, fats, and fiber balance.
- Support healthy weight loss, healthy weight gain, muscle-building nutrition, and maintenance.
- Build personalized full-day diet plans (Indian home meals, South/North Indian options, high-protein veg/eggetarian/non-veg/vegan meals, and global dishes), food & fruit swaps, hydration reminders, and meal timing.
- Explain and review the user's actual logged food scan history for today and the past 7 days.

STRICT GROUNDING & HONESTY RULES:
1. Rely ONLY on the verified user data JSON below. NEVER invent food logs, past meals, calorie totals, weights, or personal attributes that are not present in the data.
2. If today's mealCount is 0, clearly say they have not logged any meals today yet and invite them to scan a meal or tell you what they ate for general estimates.
3. Missing profile fields: ${ctx.missingProfileFields.length > 0 ? ctx.missingProfileFields.join(', ') : 'None (all core profile details available)'}.
   - If any of these are missing and relevant to giving personalized calorie/macro advice, politely ask the user for those missing details (age, height in cm, weight in kg, activity level, fitness goal) one or two at a time.
4. When the user tells you or corrects their age, height, weight, activity level, fitness goal, or food preference, IMMEDIATELY call the tool "update_user_diet_profile" so their RosoFood profile stays accurate.
5. If the user asks you to update their daily calorie or macro targets, call "update_daily_goals" (always keeping calories >= 1200 kcal/day).

SAFETY & DISCLAIMER RULES:
- Give general nutrition and wellness guidance only — NEVER provide medical diagnosis, disease treatment, or prescription advice. Recommend consulting a licensed doctor or registered dietitian for medical conditions (diabetes, PCOS, kidney/heart conditions, pregnancy, allergies, eating disorders).
- NEVER recommend starvation, crash diets, extreme calorie restriction (< 1200 kcal/day), or unsafe supplements.
- Mention clearly when giving calorie or nutrition numbers that AI nutrition estimates are approximate.

VERIFIED USER CONTEXT JSON:
${JSON.stringify(ctx)}`;
}

export const updateDietProfileTool: FunctionDeclaration = {
  name: 'update_user_diet_profile',
  description:
    'Saves or updates the user profile details (age, heightCm, weightKg, activityLevel, fitnessGoal, dietaryPreference) when the user shares or corrects them.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      age: { type: Type.NUMBER, description: 'Age in years (13 to 100).' },
      heightCm: { type: Type.NUMBER, description: 'Height in centimeters (100 to 250).' },
      weightKg: { type: Type.NUMBER, description: 'Weight in kilograms (25 to 300).' },
      activityLevel: {
        type: Type.STRING,
        description: 'One of: sedentary, light, moderate, active.',
      },
      fitnessGoal: {
        type: Type.STRING,
        description: 'One of: weight_loss, weight_gain, muscle_building, maintenance.',
      },
      dietaryPreference: {
        type: Type.STRING,
        description: 'One of: vegetarian, non-vegetarian, eggetarian, vegan.',
      },
    },
  },
};

export const updateDailyGoalsTool: FunctionDeclaration = {
  name: 'update_daily_goals',
  description:
    'Updates the user daily calorie (minimum 1200 kcal) and macro targets in their RosoFood profile when requested by the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      caloriesKcal: { type: Type.NUMBER, description: 'Safe daily calorie target (>= 1200 kcal).' },
      proteinGrams: { type: Type.NUMBER, description: 'Daily protein target in grams.' },
      carbsGrams: { type: Type.NUMBER, description: 'Daily carbohydrates target in grams.' },
      fatGrams: { type: Type.NUMBER, description: 'Daily fat target in grams.' },
      fiberGrams: { type: Type.NUMBER, description: 'Daily fiber target in grams.' },
    },
    required: ['caloriesKcal', 'proteinGrams', 'carbsGrams', 'fatGrams', 'fiberGrams'],
  },
};

export function extractLiveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const ev = err as {
      message?: unknown;
      reason?: unknown;
      code?: unknown;
      error?: unknown;
    };
    if (typeof ev.message === 'string' && ev.message.trim()) {
      return ev.message.trim();
    }
    if (ev.error instanceof Error && ev.error.message) {
      return ev.error.message;
    }
    if (typeof ev.reason === 'string' && ev.reason.trim()) {
      const codeStr = typeof ev.code === 'number' ? ` (code ${ev.code})` : '';
      return `${ev.reason.trim()}${codeStr}`;
    }
    if (typeof ev.code === 'number') {
      return `${fallback} (code ${ev.code})`;
    }
  }
  return fallback;
}
