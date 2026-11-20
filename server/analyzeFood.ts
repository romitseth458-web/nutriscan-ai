import { GoogleGenAI, Type, type Schema } from '@google/genai';
import type { FoodAnalysisResult } from '../src/types/nutrition.ts';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

export class UpstreamApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'UpstreamApiError';
    this.statusCode = statusCode;
  }
}

function normalizeMimeType(mimeType: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const normalized = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    throw new ValidationError(
      'Unsupported image format. Please upload a JPG, JPEG, PNG, or WebP image.'
    );
  }
  if (normalized === 'image/png') return 'image/png';
  if (normalized === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function detectMimeFromBuffer(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length < 12) return null;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return 'image/jpeg';

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  if (isPng) return 'image/png';

  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (isWebp) return 'image/webp';

  return null;
}

function validateAndDetectImage(
  base64Data: string,
  declaredMimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): { cleanBase64: string; resolvedMimeType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const cleaned = base64Data
    .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) {
    throw new ValidationError('No image data was received.');
  }

  const estimatedBytes = Math.floor((cleaned.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image exceeds the 8 MB maximum file size limit.');
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleaned, 'base64');
  } catch {
    throw new ValidationError('Invalid base64 image payload.');
  }

  if (buffer.length < 100) {
    throw new ValidationError('Uploaded file appears empty or corrupted.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image exceeds the 8 MB maximum file size limit.');
  }

  const detectedMime = detectMimeFromBuffer(buffer);
  if (!detectedMime) {
    throw new ValidationError(
      'Uploaded file is not a valid JPEG, PNG, or WebP image. Please try another photo.'
    );
  }

  // Trust actual magic bytes if extension/mime metadata mismatched (common with mobile/WhatsApp saves)
  return {
    cleanBase64: cleaned,
    resolvedMimeType: detectedMime || declaredMimeType,
  };
}

const analysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    identificationStatus: {
      type: Type.STRING,
      description:
        'Use "identified" when food is clearly recognizable enough for a reasonable estimate, "needs_clarification" when dish/ingredients/portion are too ambiguous or blurry, and "not_food" when the image does not depict food or beverages.',
    },
    confidence: {
      type: Type.STRING,
      description: 'One of "high", "medium", or "low".',
    },
    clarificationQuestion: {
      type: Type.STRING,
      description:
        'If identificationStatus is "needs_clarification" or "not_food", a concise, helpful question asking the user what is in the dish, cooking method, or portion size. Empty string if confidently identified.',
    },
    mealTitle: {
      type: Type.STRING,
      description: 'Human-friendly meal name, e.g. "Grilled Salmon Quinoa Bowl".',
    },
    estimatedServingSizeGrams: {
      type: Type.NUMBER,
      description: 'Total estimated edible serving weight in grams.',
    },
    servingDescription: {
      type: Type.STRING,
      description: 'Human-readable serving summary, e.g. "1 medium plate (~420 g)".',
    },
    totals: {
      type: Type.OBJECT,
      properties: {
        caloriesKcal: { type: Type.NUMBER },
        proteinGrams: { type: Type.NUMBER },
        carbsGrams: { type: Type.NUMBER },
        fatGrams: { type: Type.NUMBER },
        fiberGrams: { type: Type.NUMBER },
      },
      required: ['caloriesKcal', 'proteinGrams', 'carbsGrams', 'fatGrams', 'fiberGrams'],
    },
    items: {
      type: Type.ARRAY,
      description: 'Individual visible food components detected in the image.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          portionGrams: { type: Type.NUMBER },
          caloriesKcal: { type: Type.NUMBER },
          proteinGrams: { type: Type.NUMBER },
          carbsGrams: { type: Type.NUMBER },
          fatGrams: { type: Type.NUMBER },
          fiberGrams: { type: Type.NUMBER },
          preparationNote: {
            type: Type.STRING,
            description: 'Short note on preparation or visual cue, e.g. "Pan-seared with light oil".',
          },
        },
        required: [
          'name',
          'portionGrams',
          'caloriesKcal',
          'proteinGrams',
          'carbsGrams',
          'fatGrams',
          'fiberGrams',
          'preparationNote',
        ],
      },
    },
    dietSuggestions: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Practical, plain-language nutrition and balance advice for this meal.',
        },
        healthierAlternatives: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              reason: { type: Type.STRING },
              estimatedCalorieSavingsKcal: { type: Type.NUMBER },
            },
            required: ['title', 'reason', 'estimatedCalorieSavingsKcal'],
          },
        },
        highProteinOptions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              proteinBoostGrams: { type: Type.NUMBER },
              description: { type: Type.STRING },
            },
            required: ['title', 'proteinBoostGrams', 'description'],
          },
        },
        vegetarianOptions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['title', 'description'],
          },
        },
        nonVegetarianOptions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['title', 'description'],
          },
        },
      },
      required: [
        'summary',
        'healthierAlternatives',
        'highProteinOptions',
        'vegetarianOptions',
        'nonVegetarianOptions',
      ],
    },
    estimationDisclaimer: {
      type: Type.STRING,
      description:
        'Brief note reminding the user that visual calorie and macro values are estimates and vary by hidden oils, sauces, and exact portion weights.',
    },
  },
  required: [
    'identificationStatus',
    'confidence',
    'clarificationQuestion',
    'mealTitle',
    'estimatedServingSizeGrams',
    'servingDescription',
    'totals',
    'items',
    'dietSuggestions',
    'estimationDisclaimer',
  ],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round1(val: number): number {
  return Math.round((Number.isFinite(val) ? Math.max(0, val) : 0) * 10) / 10;
}

function roundInt(val: number): number {
  return Math.round(Number.isFinite(val) ? Math.max(0, val) : 0);
}

function parseModelJson(rawText: string): FoodAnalysisResult {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
  }

  try {
    return JSON.parse(cleaned) as FoodAnalysisResult;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as FoodAnalysisResult;
    }
    throw new SyntaxError('Model output was not valid JSON.');
  }
}

interface ExtractedApiError {
  status?: number;
  apiStatus?: string;
  message: string;
}

function extractErrorDetails(error: unknown, fallbackMsg: string): ExtractedApiError {
  const errObj = error as { status?: number; statusCode?: number; code?: number; message?: string };
  let status = errObj?.status ?? errObj?.statusCode;
  let apiStatus: string | undefined;
  let message = errObj?.message || fallbackMsg;

  // Attempt to parse JSON payload embedded in SDK error message
  try {
    const firstBrace = message.indexOf('{');
    if (firstBrace !== -1) {
      const parsedErr = JSON.parse(message.slice(firstBrace)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsedErr?.error) {
        if (typeof parsedErr.error.code === 'number' && !status) {
          status = parsedErr.error.code;
        }
        if (parsedErr.error.status) {
          apiStatus = parsedErr.error.status;
        }
        if (parsedErr.error.message) {
          message = parsedErr.error.message;
        }
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
    else if (/API_KEY_INVALID|API key not valid/i.test(message)) status = 400;
  }

  return { status, apiStatus, message };
}

function isRetryableFailure(error: unknown, extracted: ExtractedApiError): boolean {
  if (error instanceof SyntaxError) return true;
  if (error instanceof UpstreamApiError && error.statusCode >= 500) return true;
  const s = extracted.status;
  if (s === 429 || s === 500 || s === 502 || s === 503 || s === 504) return true;
  if (!s && /fetch|network|timeout|ECONNRESET|ETIMEDOUT|empty/i.test(extracted.message)) {
    return true;
  }
  return false;
}

function sanitizeResult(raw: FoodAnalysisResult): FoodAnalysisResult {
  const status =
    raw.identificationStatus === 'needs_clarification' || raw.identificationStatus === 'not_food'
      ? raw.identificationStatus
      : 'identified';

  const confidence =
    raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : 'medium';

  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => ({
        name: String(item.name || 'Food item').trim(),
        portionGrams: roundInt(item.portionGrams),
        caloriesKcal: roundInt(item.caloriesKcal),
        proteinGrams: round1(item.proteinGrams),
        carbsGrams: round1(item.carbsGrams),
        fatGrams: round1(item.fatGrams),
        fiberGrams: round1(item.fiberGrams),
        preparationNote: String(item.preparationNote || 'Standard preparation').trim(),
      }))
    : [];

  const sumItems = items.reduce(
    (acc, item) => ({
      portionGrams: acc.portionGrams + item.portionGrams,
      caloriesKcal: acc.caloriesKcal + item.caloriesKcal,
      proteinGrams: acc.proteinGrams + item.proteinGrams,
      carbsGrams: acc.carbsGrams + item.carbsGrams,
      fatGrams: acc.fatGrams + item.fatGrams,
      fiberGrams: acc.fiberGrams + item.fiberGrams,
    }),
    { portionGrams: 0, caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
  );

  const rawServingGrams = roundInt(raw.estimatedServingSizeGrams);
  const rawCalories = roundInt(raw.totals?.caloriesKcal ?? 0);

  return {
    identificationStatus: status,
    confidence,
    clarificationQuestion: String(raw.clarificationQuestion || '').trim(),
    mealTitle: String(raw.mealTitle || (items[0]?.name ? items[0].name : 'Analyzed Meal')).trim(),
    estimatedServingSizeGrams:
      rawServingGrams > 0 ? rawServingGrams : roundInt(sumItems.portionGrams),
    servingDescription:
      String(raw.servingDescription || '').trim() ||
      (sumItems.portionGrams > 0 ? `Approx. ${roundInt(sumItems.portionGrams)} g serving` : ''),
    totals: {
      caloriesKcal: rawCalories > 0 ? rawCalories : roundInt(sumItems.caloriesKcal),
      proteinGrams:
        round1(raw.totals?.proteinGrams ?? 0) || round1(sumItems.proteinGrams),
      carbsGrams: round1(raw.totals?.carbsGrams ?? 0) || round1(sumItems.carbsGrams),
      fatGrams: round1(raw.totals?.fatGrams ?? 0) || round1(sumItems.fatGrams),
      fiberGrams: round1(raw.totals?.fiberGrams ?? 0) || round1(sumItems.fiberGrams),
    },
    items,
    dietSuggestions: {
      summary: String(raw.dietSuggestions?.summary || '').trim(),
      healthierAlternatives: Array.isArray(raw.dietSuggestions?.healthierAlternatives)
        ? raw.dietSuggestions.healthierAlternatives.slice(0, 4).map((alt) => ({
            title: String(alt.title || '').trim(),
            reason: String(alt.reason || '').trim(),
            estimatedCalorieSavingsKcal: roundInt(alt.estimatedCalorieSavingsKcal),
          }))
        : [],
      highProteinOptions: Array.isArray(raw.dietSuggestions?.highProteinOptions)
        ? raw.dietSuggestions.highProteinOptions.slice(0, 4).map((opt) => ({
            title: String(opt.title || '').trim(),
            proteinBoostGrams: round1(opt.proteinBoostGrams),
            description: String(opt.description || '').trim(),
          }))
        : [],
      vegetarianOptions: Array.isArray(raw.dietSuggestions?.vegetarianOptions)
        ? raw.dietSuggestions.vegetarianOptions.slice(0, 4).map((opt) => ({
            title: String(opt.title || '').trim(),
            description: String(opt.description || '').trim(),
          }))
        : [],
      nonVegetarianOptions: Array.isArray(raw.dietSuggestions?.nonVegetarianOptions)
        ? raw.dietSuggestions.nonVegetarianOptions.slice(0, 4).map((opt) => ({
            title: String(opt.title || '').trim(),
            description: String(opt.description || '').trim(),
          }))
        : [],
    },
    estimationDisclaimer:
      String(raw.estimationDisclaimer || '').trim() ||
      'Values are visual estimates based on typical portion densities and visible ingredients.',
  };
}

function throwMappedUpstreamError(lastError: unknown, fallbackMessage: string): never {
  if (lastError instanceof ValidationError) {
    throw lastError;
  }

  const { status, apiStatus, message } = extractErrorDetails(lastError, fallbackMessage);

  if (status === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    throw new UpstreamApiError(
      'Gemini API quota or rate limit reached. Please wait a moment and try again, or check your quota in Settings > Secrets.',
      429
    );
  }
  if (status === 503 || apiStatus === 'UNAVAILABLE') {
    throw new UpstreamApiError(
      'The AI vision service is temporarily busy. Please try again in a few seconds.',
      503
    );
  }
  if (status === 401 || status === 403 || apiStatus === 'PERMISSION_DENIED') {
    throw new UpstreamApiError(
      'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.',
      403
    );
  }
  if (status === 400 && /API_KEY_INVALID|API key/i.test(message)) {
    throw new UpstreamApiError(
      'Gemini API key is invalid. Please update GEMINI_API_KEY in Settings > Secrets.',
      400
    );
  }
  if (status === 404 || apiStatus === 'NOT_FOUND') {
    throw new UpstreamApiError(
      'The configured Gemini model could not be reached. Please retry or check model configuration.',
      502
    );
  }
  if (lastError instanceof UpstreamApiError) {
    throw lastError;
  }

  throw new UpstreamApiError(message, status && status >= 400 && status < 600 ? status : 502);
}

export interface AnalyzeFoodInput {
  imageBase64: string;
  mimeType: string;
  clarification?: string;
}

export async function analyzeFoodImage(input: AnalyzeFoodInput): Promise<FoodAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new UpstreamApiError(
      'Server Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
      500
    );
  }

  const declaredMime = normalizeMimeType(input.mimeType);
  const { cleanBase64, resolvedMimeType } = validateAndDetectImage(input.imageBase64, declaredMime);
  const userClarification =
    typeof input.clarification === 'string' ? input.clarification.trim().slice(0, 300) : '';

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `You are a registered dietitian and computer-vision nutrition analyst for RosoFood AI.
Analyze the uploaded food or fruit photograph carefully and return structured nutritional estimates in JSON.

Rules:
1. Recognize ALL categories of food and ALL fruits: fresh fruits (apples, bananas, mangoes, papayas, melons, citrus, berries, kiwi, pomegranate, guava, grapes, custard apple, chikoo, lychee, dragon fruit, dates, etc.), South Indian meals & tiffins (idli, rava idli, plain/masala/rava dosa, pesarattu, adai, uttapam, medu vada, paniyaram, ven pongal, upma, appam with stew, idiyappam, puttu with kadala curry, bisibele bath, curd rice, lemon rice, puliyogare, sambar, rasam, avial, poriyal, malabar parotta, chettinad chicken, kerala fish curry, filter coffee), North & Pan-Indian dishes (roti, paratha, dal, rice, paneer, thali, rajma, chole, biryani, chaat, dhokla, pav bhaji), global meals, proteins, dairy, nuts/seeds, snacks, fast food, and beverages.
2. Identify all distinct visible food or fruit items on the plate/bowl/table when multiple items are present.
3. Estimate realistic portion sizes in grams using visual cues (plate diameter, fruit count/size, utensil scale, food density).
4. Ensure the meal totals (caloriesKcal, proteinGrams, carbsGrams, fatGrams, fiberGrams) and estimatedServingSizeGrams are consistent with the sum of the detected items.
5. If the image is NOT food/beverage/fruit, set identificationStatus to "not_food", confidence to "low", zero out nutrition totals, empty items, and set clarificationQuestion explaining that no food was detected and asking for a meal or fruit photo.
6. If the food is too blurry, heavily obscured, or visually ambiguous AND no helpful user clarification was provided, set identificationStatus to "needs_clarification", confidence to "low", and write a specific, helpful clarificationQuestion asking what dish, sauce, or portion size it is.
7. When identificationStatus is "identified", provide practical, realistic dietSuggestions including:
   - 2-3 healthierAlternatives with realistic estimated calorie savings
   - 2-3 highProteinOptions with estimated protein boost in grams
   - 2-3 vegetarianOptions (plant-forward or lacto-ovo vegetarian swaps/additions)
   - 2-3 nonVegetarianOptions (lean meat/fish/poultry swaps/additions)
8. Keep all copy concise, accurate, and grounded in nutritional science.`;

  const promptText = userClarification
    ? `Analyze this food image. The user provided this clarification to help identify the meal or portion: "${userClarification}". Estimate portion weights in grams, calories, protein, carbs, fat, fiber, and tailored diet recommendations.`
    : `Analyze this food image. Identify all visible food items, estimate portion weights in grams, calculate calories, protein, carbs, fat, fiber, and provide tailored vegetarian, non-vegetarian, and high-protein diet recommendations. If you cannot reliably identify the dish, ask for clarification.`;

  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    let shouldTryNextModel = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: resolvedMimeType,
                  data: cleanBase64,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: analysisResponseSchema,
          },
        });

        const blockReason = response.candidates?.[0]?.finishReason;
        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
          if (blockReason && String(blockReason) !== 'STOP') {
            throw new UpstreamApiError(
              `Image analysis could not complete (${String(blockReason)}). Please try a clearer food photo.`,
              422
            );
          }
          throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
        }

        const parsed = parseModelJson(jsonText);
        return sanitizeResult(parsed);
      } catch (error: unknown) {
        lastError = error;
        const extracted = extractErrorDetails(error, 'Failed to analyze food image with Gemini Vision.');

        if (extracted.status === 400 || extracted.status === 401 || extracted.status === 403 || extracted.status === 404) {
          shouldTryNextModel = false;
          break;
        }

        if (isRetryableFailure(error, extracted)) {
          shouldTryNextModel = true;
          if (attempt < 1) {
            await sleep(450 * (attempt + 1));
          }
          continue;
        }

        shouldTryNextModel = false;
        break;
      }
    }

    if (!shouldTryNextModel) {
      break;
    }
  }

  throwMappedUpstreamError(lastError, 'Failed to analyze food image with Gemini Vision.');
}

export async function analyzeFoodText(query: string): Promise<FoodAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new UpstreamApiError(
      'Server Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
      500
    );
  }

  const trimmed = typeof query === 'string' ? query.trim().slice(0, 300) : '';
  if (trimmed.length < 2) {
    throw new ValidationError('Please enter a food, fruit, or meal description to estimate.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `You are a registered dietitian for RosoFood AI.
Given a user-entered food, fruit, snack, beverage, or meal description (with optional portion size or count), return accurate structured nutritional estimates in JSON.

Rules:
1. Support EVERY kind of food and EVERY fruit (fresh fruits, dried fruits, juices, South Indian dishes like idli, dosa, pesarattu, uttapam, vada, pongal, appam, puttu, bisibele bath, curd rice, lemon rice, sambar, rasam, avial, poriyal, parotta, chettinad & kerala curries; North & Pan-Indian meals like roti, paratha, dal, paneer, chole, rajma, biryani, khichdi, dhokla, chaat; global cuisine, fast food, dairy, nuts/seeds, protein foods).
2. Break mixed meals down into individual items in "items" (e.g., "2 rotis + 1 bowl dal" -> 2 separate items). For single items like "1 medium mango", include 1 item with its standard edible weight in grams.
3. If the input is clearly NOT an edible food, fruit, or drink, set identificationStatus to "not_food", confidence to "low", zero out macros, and write a helpful clarificationQuestion.
4. Ensure meal totals match the sum of items.
5. Provide realistic healthierAlternatives, highProteinOptions, vegetarianOptions, and nonVegetarianOptions.`;

  const promptText = `Estimate complete nutrition facts, portion weight in grams, macros, fiber, and tailored diet recommendations for: "${trimmed}"`;

  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
  let lastError: unknown;

  for (const modelName of modelsToTry) {
    let shouldTryNextModel = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: analysisResponseSchema,
          },
        });

        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
          throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
        }

        const parsed = parseModelJson(jsonText);
        return sanitizeResult(parsed);
      } catch (error: unknown) {
        lastError = error;
        const extracted = extractErrorDetails(error, 'Failed to estimate nutrition for this food.');

        if (extracted.status === 400 || extracted.status === 401 || extracted.status === 403 || extracted.status === 404) {
          shouldTryNextModel = false;
          break;
        }

        if (isRetryableFailure(error, extracted)) {
          shouldTryNextModel = true;
          if (attempt < 1) {
            await sleep(450 * (attempt + 1));
          }
          continue;
        }

        shouldTryNextModel = false;
        break;
      }
    }

    if (!shouldTryNextModel) {
      break;
    }
  }

  throwMappedUpstreamError(lastError, 'Failed to estimate nutrition for this food.');
}
