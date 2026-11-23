import { GoogleGenAI, ThinkingLevel, Type, type Schema } from '@google/genai';
import {
  computeMacrosFromReference,
  findIndianFoodReference,
} from '../src/data/indianFoodReferenceDb.ts';
import type {
  DietActivityLevel,
  DietaryPreference,
  DietBiologicalSex,
  DietFitnessGoal,
  IndianMealPlan,
  MacroTotals,
  MealPlannerInput,
  MealPlanSlotId,
  MealPlanSlotLabel,
  PlannedFoodItem,
  PlannedMeal,
} from '../src/types/nutrition.ts';
import { UpstreamApiError, ValidationError } from './analyzeFood.ts';

const GEMINI_TIMEOUT_MS = 32_000;

const SLOT_META: Record<
  MealPlanSlotId,
  { slotLabel: MealPlanSlotLabel; defaultTiming: string; calorieShare: number; budgetShare: number }
> = {
  breakfast: {
    slotLabel: 'Breakfast',
    defaultTiming: '7:30 AM – 9:00 AM',
    calorieShare: 0.24,
    budgetShare: 0.22,
  },
  mid_morning: {
    slotLabel: 'Mid-Morning Snack',
    defaultTiming: '10:30 AM – 11:30 AM',
    calorieShare: 0.1,
    budgetShare: 0.12,
  },
  lunch: {
    slotLabel: 'Lunch',
    defaultTiming: '1:00 PM – 2:30 PM',
    calorieShare: 0.3,
    budgetShare: 0.3,
  },
  evening_snack: {
    slotLabel: 'Evening Snack',
    defaultTiming: '4:30 PM – 5:30 PM',
    calorieShare: 0.11,
    budgetShare: 0.12,
  },
  dinner: {
    slotLabel: 'Dinner',
    defaultTiming: '7:30 PM – 9:00 PM',
    calorieShare: 0.25,
    budgetShare: 0.24,
  },
};

const SLOT_IDS: MealPlanSlotId[] = [
  'breakfast',
  'mid_morning',
  'lunch',
  'evening_snack',
  'dinner',
];

const ACTIVITY_FACTORS: Record<DietActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

function round1(val: number): number {
  return Math.round((Number.isFinite(val) ? Math.max(0, val) : 0) * 10) / 10;
}

function roundInt(val: number): number {
  return Math.round(Number.isFinite(val) ? Math.max(0, val) : 0);
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
    throw new UpstreamApiError('Gemini returned an empty meal plan response. Please retry.', 502);
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
      'The AI meal planner service is temporarily busy. Please retry in a few seconds.',
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

export function validateMealPlannerInput(raw: unknown): MealPlannerInput {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Missing body metrics and meal preferences.');
  }
  const obj = raw as Record<string, unknown>;
  const missing: string[] = [];

  const age = Number(obj.age);
  const heightCm = Number(obj.heightCm);
  const weightKg = Number(obj.weightKg);
  const dailyBudgetInr = Number(obj.dailyBudgetInr);
  const sex = obj.sex;
  const fitnessGoal = obj.fitnessGoal;
  const activityLevel = obj.activityLevel;
  const dietaryPreference = obj.dietaryPreference;

  if (!Number.isFinite(age) || age < 13 || age > 100) missing.push('Age (13–100 yrs)');
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
    missing.push('Height (100–250 cm)');
  }
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 300) {
    missing.push('Current Weight (25–300 kg)');
  }
  if (sex !== 'male' && sex !== 'female') missing.push('Sex');
  if (
    fitnessGoal !== 'weight_loss' &&
    fitnessGoal !== 'weight_gain' &&
    fitnessGoal !== 'muscle_building' &&
    fitnessGoal !== 'maintenance'
  ) {
    missing.push('Fitness Goal');
  }
  if (
    activityLevel !== 'sedentary' &&
    activityLevel !== 'light' &&
    activityLevel !== 'moderate' &&
    activityLevel !== 'active'
  ) {
    missing.push('Activity Level');
  }
  if (
    dietaryPreference !== 'vegetarian' &&
    dietaryPreference !== 'non-vegetarian' &&
    dietaryPreference !== 'eggetarian' &&
    dietaryPreference !== 'vegan'
  ) {
    missing.push('Food Preference');
  }
  if (!Number.isFinite(dailyBudgetInr) || dailyBudgetInr < 50 || dailyBudgetInr > 5000) {
    missing.push('Daily Food Budget (₹50–₹5000)');
  }

  if (missing.length > 0) {
    throw new ValidationError(`Please provide valid values for: ${missing.join(', ')}.`, 400);
  }

  return {
    age: Math.round(age),
    heightCm: round1(heightCm),
    weightKg: round1(weightKg),
    sex: sex as DietBiologicalSex,
    fitnessGoal: fitnessGoal as DietFitnessGoal,
    activityLevel: activityLevel as DietActivityLevel,
    dietaryPreference: dietaryPreference as DietaryPreference,
    dailyBudgetInr: Math.round(dailyBudgetInr),
  };
}

export function computeSafeCalorieTargets(input: MealPlannerInput): {
  estimatedBmrKcal: number;
  estimatedTdeeKcal: number;
  targetDailyCaloriesKcal: number;
  safetyNote: string;
} {
  const bmrRaw =
    input.sex === 'male'
      ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5
      : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;

  const estimatedBmrKcal = Math.max(800, Math.round(bmrRaw));
  const estimatedTdeeKcal = Math.max(
    1100,
    Math.round((bmrRaw * ACTIVITY_FACTORS[input.activityLevel]) / 10) * 10
  );

  const safeFloor = input.sex === 'male' ? 1500 : 1200;
  let targetDailyCaloriesKcal = estimatedTdeeKcal;
  let safetyNote = `Estimated maintenance (~${estimatedTdeeKcal} kcal/day) using Mifflin-St Jeor balance.`;

  if (input.fitnessGoal === 'weight_loss') {
    const rawDeficitTarget = Math.round((estimatedTdeeKcal - 400) / 10) * 10;
    targetDailyCaloriesKcal = Math.max(safeFloor, rawDeficitTarget);
    if (rawDeficitTarget < safeFloor) {
      safetyNote = `Clamped to safe minimum (${safeFloor} kcal/day) to avoid extreme energy restriction.`;
    } else {
      safetyNote = `Moderate ~400 kcal deficit from TDEE (${estimatedTdeeKcal} kcal) for steady, safe fat loss.`;
    }
  } else if (input.fitnessGoal === 'weight_gain') {
    targetDailyCaloriesKcal = Math.min(4800, Math.round((estimatedTdeeKcal + 350) / 10) * 10);
    safetyNote = `Steady ~350 kcal surplus above TDEE (${estimatedTdeeKcal} kcal) using wholesome Indian staples.`;
  } else if (input.fitnessGoal === 'muscle_building') {
    targetDailyCaloriesKcal = Math.min(4800, Math.round((estimatedTdeeKcal + 250) / 10) * 10);
    safetyNote = `Lean ~250 kcal surplus above TDEE (${estimatedTdeeKcal} kcal) prioritizing protein distribution.`;
  }

  return {
    estimatedBmrKcal,
    estimatedTdeeKcal,
    targetDailyCaloriesKcal,
    safetyNote,
  };
}

interface RawPlannedItem {
  name: string;
  hindiName?: string;
  portionGrams: number;
  portionLabel: string;
  estimatedCostInr: number;
  preparationNote: string;
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

interface RawPlannedMeal {
  slotId: string;
  timingWindow?: string;
  title: string;
  tip?: string;
  items: RawPlannedItem[];
}

interface RawMealPlanResponse {
  planName: string;
  hydrationTip: string;
  budgetSummary: string;
  meals: RawPlannedMeal[];
  estimationDisclaimer: string;
}

const plannedItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Clear English Indian food item name.' },
    hindiName: { type: Type.STRING, description: 'Hindi name in Devanagari (e.g. "रोटी").' },
    portionGrams: { type: Type.NUMBER, description: 'Cooked/edible weight in grams.' },
    portionLabel: {
      type: Type.STRING,
      description: 'Household Indian serving description, e.g. "2 rotis (80 g)" or "1 katori (180 g)".',
    },
    estimatedCostInr: { type: Type.NUMBER, description: 'Approximate homemade cost in INR.' },
    preparationNote: { type: Type.STRING, description: 'Brief homestyle cooking/oil note.' },
    caloriesKcal: { type: Type.NUMBER },
    proteinGrams: { type: Type.NUMBER },
    carbsGrams: { type: Type.NUMBER },
    fatGrams: { type: Type.NUMBER },
    fiberGrams: { type: Type.NUMBER },
  },
  required: [
    'name',
    'hindiName',
    'portionGrams',
    'portionLabel',
    'estimatedCostInr',
    'preparationNote',
    'caloriesKcal',
    'proteinGrams',
    'carbsGrams',
    'fatGrams',
    'fiberGrams',
  ],
};

const plannedMealSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    slotId: {
      type: Type.STRING,
      description: 'Must be one of: breakfast, mid_morning, lunch, evening_snack, dinner.',
    },
    timingWindow: { type: Type.STRING },
    title: { type: Type.STRING, description: 'Meal combo title (e.g. "Poha & Boiled Eggs").' },
    tip: { type: Type.STRING, description: 'Practical nutrition or pairing tip for this meal.' },
    items: {
      type: Type.ARRAY,
      items: plannedItemSchema,
    },
  },
  required: ['slotId', 'timingWindow', 'title', 'tip', 'items'],
};

const fullPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    planName: { type: Type.STRING },
    hydrationTip: { type: Type.STRING },
    budgetSummary: { type: Type.STRING },
    meals: {
      type: Type.ARRAY,
      items: plannedMealSchema,
    },
    estimationDisclaimer: { type: Type.STRING },
  },
  required: ['planName', 'hydrationTip', 'budgetSummary', 'meals', 'estimationDisclaimer'],
};

const replaceItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    item: plannedItemSchema,
  },
  required: ['item'],
};

function groundPlannedItem(raw: RawPlannedItem, idx: number, idPrefix = 'item'): PlannedFoodItem {
  const cleanName = String(raw.name || 'Indian Food Item').trim().slice(0, 120);
  const rawHindi = String(raw.hindiName || '').trim().slice(0, 120);
  const refMatch =
    findIndianFoodReference(cleanName) ||
    (rawHindi ? findIndianFoodReference(rawHindi) : null);

  const safeGrams = Math.max(
    10,
    Math.min(1200, roundInt(raw.portionGrams) || refMatch?.defaultPortionGrams || 100)
  );

  const geminiCalories = roundInt(raw.caloriesKcal);
  const geminiProtein = round1(raw.proteinGrams);
  const geminiCarbs = round1(raw.carbsGrams);
  const geminiFat = round1(raw.fatGrams);
  const geminiFiber = round1(raw.fiberGrams);

  let finalMacros: MacroTotals = {
    caloriesKcal: geminiCalories,
    proteinGrams: geminiProtein,
    carbsGrams: geminiCarbs,
    fatGrams: geminiFat,
    fiberGrams: geminiFiber,
  };
  let nutritionSource: 'reference_db' | 'gemini_estimate' = 'gemini_estimate';
  let referenceFoodId: string | undefined;

  if (refMatch) {
    const refMacros = computeMacrosFromReference(refMatch, safeGrams);
    const ratio =
      refMacros.caloriesKcal > 0 && geminiCalories > 0
        ? geminiCalories / refMacros.caloriesKcal
        : 0;
    const withinRange = ratio >= 0.65 && ratio <= 1.4;
    nutritionSource = 'reference_db';
    referenceFoodId = refMatch.id;
    if (!withinRange) {
      finalMacros = refMacros;
    }
  }

  return {
    id: `${idPrefix}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    hindiName: rawHindi || refMatch?.hindiName || undefined,
    portionGrams: safeGrams,
    portionLabel:
      String(raw.portionLabel || '').trim().slice(0, 80) || `${safeGrams} g serving`,
    estimatedCostInr: Math.max(2, Math.min(2000, roundInt(raw.estimatedCostInr))),
    preparationNote:
      String(raw.preparationNote || '').trim().slice(0, 200) ||
      refMatch?.defaultCookingMethod ||
      'Homestyle preparation',
    nutritionSource,
    ...(referenceFoodId ? { referenceFoodId } : {}),
    ...finalMacros,
  };
}

function finalizePlannedMeal(raw: RawPlannedMeal | undefined, slotId: MealPlanSlotId): PlannedMeal {
  const meta = SLOT_META[slotId];
  const items = Array.isArray(raw?.items)
    ? raw.items.slice(0, 6).map((item, idx) => groundPlannedItem(item, idx, slotId))
    : [];

  const totals = items.reduce<MacroTotals>(
    (acc, item) => ({
      caloriesKcal: acc.caloriesKcal + item.caloriesKcal,
      proteinGrams: round1(acc.proteinGrams + item.proteinGrams),
      carbsGrams: round1(acc.carbsGrams + item.carbsGrams),
      fatGrams: round1(acc.fatGrams + item.fatGrams),
      fiberGrams: round1(acc.fiberGrams + item.fiberGrams),
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
  );

  const estimatedCostInr = items.reduce((sum, item) => sum + item.estimatedCostInr, 0);

  return {
    slotId,
    slotLabel: meta.slotLabel,
    timingWindow: String(raw?.timingWindow || meta.defaultTiming).trim().slice(0, 60),
    title: String(raw?.title || meta.slotLabel).trim().slice(0, 140),
    totals,
    estimatedCostInr: Math.round(estimatedCostInr),
    items,
    tip: String(raw?.tip || '').trim().slice(0, 260),
  };
}

function getDietaryRule(pref: DietaryPreference): string {
  switch (pref) {
    case 'vegetarian':
      return 'STRICTLY Vegetarian (NO meat, poultry, fish, seafood, or eggs). Allow dairy (milk, curd, paneer), dals, legumes, soy chunks, roti, rice, oats, fruits, vegetables.';
    case 'eggetarian':
      return 'Eggetarian (eggs + vegetarian staples allowed; NO chicken, meat, fish, or seafood).';
    case 'vegan':
      return 'STRICTLY Vegan (NO dairy/milk/curd/paneer/ghee, NO eggs, NO meat/fish). Use dal, chana, rajma, soya chunks, sprouts, peanuts, oats, poha, roti, rice, oil, fruits, vegetables.';
    case 'non-vegetarian':
      return 'Non-Vegetarian (eggs, chicken, fish allowed alongside affordable Indian staples like dal, roti, rice, curd, paneer, sabzi, fruits).';
  }
}

function getGoalFocusLabel(goal: DietFitnessGoal): string {
  switch (goal) {
    case 'weight_loss':
      return 'Weight Loss (high satiety, high fiber & protein, moderate oil/ghee, controlled portions)';
    case 'weight_gain':
      return 'Healthy Weight Gain (calorie-dense nutritious Indian combos like paneer, banana, peanuts, milk, dal-chawal, roti with light ghee)';
    case 'muscle_building':
      return 'Muscle Building (high protein across all 5 meals using eggs/chicken/paneer/curd/soya chunks/sattu/dal + complex carbs)';
    case 'maintenance':
      return 'Balanced Maintenance (steady energy, micronutrients, balanced protein, carbs, healthy fats, and fiber)';
  }
}

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

async function runGeminiStructured<T>(
  systemInstruction: string,
  prompt: string,
  schema: Schema,
  timeoutMessage: string
): Promise<T> {
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
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            ...(candidate.thinkingConfig ? { thinkingConfig: candidate.thinkingConfig } : {}),
          },
        }),
        GEMINI_TIMEOUT_MS,
        timeoutMessage
      );

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
      }
      return parseJsonSafe<T>(text);
    } catch (error: unknown) {
      lastError = error;
      const extracted = extractErrorDetails(error, 'Meal planner request failed.');
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

  throwMappedError(lastError, 'Unable to generate meal plan right now.');
}

const PLANNER_SYSTEM_INSTRUCTION = `You are RosoFood AI's Registered-Nutrition-Informed Indian Diet Planner.
Rules:
1. Design practical, everyday, affordable Indian home meals using widely available staples: poha, oats, upma, besan chilla, boiled eggs, egg bhurji, toned milk, curd/dahi, roti, steamed rice, dal tadka, rajma, chole, paneer/paneer bhurji, soya chunks, sabzi, roasted chana/sattu, sprouted moong, peanuts, seasonal fruits (banana, apple, guava, papaya).
2. Respect the user's dietary preference strictly and fit estimated daily cost near or under their INR daily budget.
3. Provide realistic cooked portionGrams and household Indian portionLabel (e.g. "2 whole wheat rotis (80 g)", "1 katori dal (180 g)").
4. Estimate realistic calories, protein, carbs, fat, fiber, and approximate home-cooked INR cost for every item.
5. Never promote extreme diets, starvation, or unsafe calories. Keep meal combinations culturally authentic and tasty.`;

export async function generateFullIndianMealPlan(rawInput: unknown): Promise<IndianMealPlan> {
  const input = validateMealPlannerInput(rawInput);
  const targets = computeSafeCalorieTargets(input);

  const slotTargetsText = SLOT_IDS.map((id) => {
    const meta = SLOT_META[id];
    const kcal = Math.round(targets.targetDailyCaloriesKcal * meta.calorieShare);
    const rs = Math.round(input.dailyBudgetInr * meta.budgetShare);
    return `- ${id} (${meta.slotLabel}): ~${kcal} kcal, ~₹${rs}`;
  }).join('\n');

  const prompt = `Generate a complete 1-day 5-meal Indian meal plan as JSON.
User Profile:
- Age: ${input.age} yrs, Sex: ${input.sex}, Height: ${input.heightCm} cm, Weight: ${input.weightKg} kg
- Goal: ${getGoalFocusLabel(input.fitnessGoal)}
- Activity: ${input.activityLevel}
- Target Daily Calories: ~${targets.targetDailyCaloriesKcal} kcal (never below 1200 kcal)
- Daily Food Budget: ₹${input.dailyBudgetInr} INR/day
- Diet Rule: ${getDietaryRule(input.dietaryPreference)}

Required 5 slots (include ALL 5 slotIds verbatim):
${slotTargetsText}

Include 2 to 4 items per meal, realistic cooked grams, INR cost estimates, Hindi names, a practical hydrationTip, and an explicit estimationDisclaimer.`;

  const raw = await runGeminiStructured<RawMealPlanResponse>(
    PLANNER_SYSTEM_INSTRUCTION,
    prompt,
    fullPlanSchema,
    'Meal plan generation timed out. Please try again.'
  );

  const meals: PlannedMeal[] = SLOT_IDS.map((slotId) => {
    const match = Array.isArray(raw.meals)
      ? raw.meals.find((m) => String(m.slotId).trim().toLowerCase() === slotId)
      : undefined;
    return finalizePlannedMeal(match, slotId);
  });

  const totals = meals.reduce<MacroTotals>(
    (acc, m) => ({
      caloriesKcal: acc.caloriesKcal + m.totals.caloriesKcal,
      proteinGrams: round1(acc.proteinGrams + m.totals.proteinGrams),
      carbsGrams: round1(acc.carbsGrams + m.totals.carbsGrams),
      fatGrams: round1(acc.fatGrams + m.totals.fatGrams),
      fiberGrams: round1(acc.fiberGrams + m.totals.fiberGrams),
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
  );

  const estimatedTotalCostInr = meals.reduce((sum, m) => sum + m.estimatedCostInr, 0);

  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    planName:
      String(raw.planName || '').trim().slice(0, 120) ||
      `${input.fitnessGoal.replace('_', ' ')} Indian Plan (${targets.targetDailyCaloriesKcal} kcal)`,
    input,
    targetDailyCaloriesKcal: targets.targetDailyCaloriesKcal,
    estimatedBmrKcal: targets.estimatedBmrKcal,
    estimatedTdeeKcal: targets.estimatedTdeeKcal,
    safetyNote: targets.safetyNote,
    hydrationTip:
      String(raw.hydrationTip || '').trim().slice(0, 500) ||
      'Drink 2.5–3 L water across the day; pair iron-rich dals with lemon juice and space meals every 3–4 hours.',
    budgetSummary:
      String(raw.budgetSummary || '').trim().slice(0, 500) ||
      `Planned around everyday Indian kitchen staples within ~₹${input.dailyBudgetInr}/day.`,
    totals,
    estimatedTotalCostInr: Math.round(estimatedTotalCostInr),
    meals,
    estimationDisclaimer:
      String(raw.estimationDisclaimer || '').trim().slice(0, 500) ||
      'Nutrition values and INR ingredient costs are approximate estimates based on standard Indian home cooking portions—not medical prescriptions.',
    updatedAtIso: new Date().toISOString(),
  };
}

export async function regenerateSingleMealSlot(params: {
  input: unknown;
  slotId: unknown;
  targetSlotCalories?: unknown;
  currentMealTitle?: unknown;
}): Promise<PlannedMeal> {
  const input = validateMealPlannerInput(params.input);
  const slotId = String(params.slotId || '').trim() as MealPlanSlotId;
  if (!SLOT_IDS.includes(slotId)) {
    throw new ValidationError('Invalid meal slot selected for regeneration.', 400);
  }

  const meta = SLOT_META[slotId];
  const targets = computeSafeCalorieTargets(input);
  const defaultSlotKcal = Math.round(targets.targetDailyCaloriesKcal * meta.calorieShare);
  const requestedKcal = Number(params.targetSlotCalories);
  const targetKcal =
    Number.isFinite(requestedKcal) && requestedKcal >= 100 && requestedKcal <= 2000
      ? Math.round(requestedKcal)
      : defaultSlotKcal;
  const targetBudget = Math.max(15, Math.round(input.dailyBudgetInr * meta.budgetShare));
  const avoidTitle =
    typeof params.currentMealTitle === 'string'
      ? params.currentMealTitle.trim().slice(0, 120)
      : '';

  const prompt = `Regenerate a fresh, different Indian "${meta.slotLabel}" meal (slotId: "${slotId}") as JSON.
Requirements:
- Goal: ${getGoalFocusLabel(input.fitnessGoal)}
- Diet Rule: ${getDietaryRule(input.dietaryPreference)}
- Target meal calories: ~${targetKcal} kcal
- Target meal budget: ~₹${targetBudget} INR
- Timing window: ${meta.defaultTiming}
${avoidTitle ? `- MUST suggest a different dish combo than: "${avoidTitle}"` : ''}
- Use affordable Indian foods (2 to 4 items), cooked portionGrams, portionLabel, Hindi names, and INR cost estimates.`;

  const rawMeal = await runGeminiStructured<RawPlannedMeal>(
    PLANNER_SYSTEM_INSTRUCTION,
    prompt,
    plannedMealSchema,
    'Meal regeneration timed out. Please retry.'
  );

  return finalizePlannedMeal(rawMeal, slotId);
}

export async function replaceMealFoodItem(params: {
  input: unknown;
  slotId: unknown;
  currentItemName: unknown;
  targetCalories?: unknown;
  preferredReplacement?: unknown;
}): Promise<PlannedFoodItem> {
  const input = validateMealPlannerInput(params.input);
  const slotId = String(params.slotId || '').trim() as MealPlanSlotId;
  if (!SLOT_IDS.includes(slotId)) {
    throw new ValidationError('Invalid meal slot for item replacement.', 400);
  }

  const currentItemName =
    typeof params.currentItemName === 'string' ? params.currentItemName.trim().slice(0, 120) : '';
  if (!currentItemName) {
    throw new ValidationError('Missing current food item name to replace.', 400);
  }

  const targetCalsNum = Number(params.targetCalories);
  const targetCals =
    Number.isFinite(targetCalsNum) && targetCalsNum >= 30 && targetCalsNum <= 1500
      ? Math.round(targetCalsNum)
      : 180;

  const preferred =
    typeof params.preferredReplacement === 'string'
      ? params.preferredReplacement.trim().slice(0, 120)
      : '';

  const meta = SLOT_META[slotId];
  const prompt = preferred
    ? `Create a single PlannedFoodItem JSON for the user's requested replacement food "${preferred}" inside an Indian ${meta.slotLabel}.
- Match ~${targetCals} kcal (or standard single serving) using realistic cooked portionGrams and household Indian portionLabel.
- Respect diet context: ${getDietaryRule(input.dietaryPreference)}.`
    : `Suggest 1 affordable Indian food replacement for "${currentItemName}" in "${meta.slotLabel}".
- Target calories: ~${targetCals} kcal
- Budget-friendly for ₹${input.dailyBudgetInr}/day
- Goal: ${getGoalFocusLabel(input.fitnessGoal)}
- STRICT Diet Rule: ${getDietaryRule(input.dietaryPreference)}
- Must be a DIFFERENT everyday Indian food than "${currentItemName}".`;

  const raw = await runGeminiStructured<{ item: RawPlannedItem }>(
    PLANNER_SYSTEM_INSTRUCTION,
    prompt,
    replaceItemSchema,
    'Food item replacement timed out. Please retry.'
  );

  if (!raw?.item?.name) {
    throw new UpstreamApiError('Could not generate a replacement food item. Please retry.', 502);
  }

  return groundPlannedItem(raw.item, 0, slotId);
}
