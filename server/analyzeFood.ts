import { GoogleGenAI, ThinkingLevel, Type, type Schema } from '@google/genai';
import {
  computeMacrosFromReference,
  findIndianFoodReference,
} from '../src/data/indianFoodReferenceDb.ts';
import type { DetectedFoodItem, FoodAnalysisResult } from '../src/types/nutrition.ts';

const GEMINI_TIMEOUT_MS = 32_000;

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
      description: 'One of "identified", "needs_clarification", or "not_food".',
    },
    confidence: {
      type: Type.STRING,
      description: 'Overall confidence: "high", "medium", or "low".',
    },
    clarificationQuestion: {
      type: Type.STRING,
      description:
        'Specific question asking user to confirm unclear dish/oil/portion if needs_clarification or not_food; empty string when clear.',
    },
    mealTitle: {
      type: Type.STRING,
      description: 'Concise meal/thali title (English, with Hindi/regional term if iconic).',
    },
    cuisineRegion: {
      type: Type.STRING,
      description:
        'Detected cuisine region such as "North Indian", "South Indian", "Punjabi", "Bengali", "Bihari", "Gujarati", "Pan-Indian", or "International".',
    },
    estimatedServingSizeGrams: {
      type: Type.NUMBER,
      description: 'Total estimated edible weight in grams.',
    },
    servingDescription: {
      type: Type.STRING,
      description: 'Short serving summary (e.g., "2 rotis + 1 katori dal + rice + sabzi").',
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
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Clear English dish name.' },
          hindiName: {
            type: Type.STRING,
            description: 'Hindi/regional name in Devanagari (e.g., "दाल तड़का"); empty string if non-Indian.',
          },
          regionalCuisine: {
            type: Type.STRING,
            description: 'E.g. North Indian, South Indian, Bihari, Bengali, Punjabi, Pan-Indian.',
          },
          cookingMethod: {
            type: Type.STRING,
            description: 'Visible preparation method (e.g. Tawa roasted, Deep-fried, Steamed, Simmered).',
          },
          keyIngredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Up to 5 visible/core ingredients.',
          },
          oilGheeSugarNote: {
            type: Type.STRING,
            description: 'Visible oil, ghee, butter, cream, or sugar syrup impact on calories/fat.',
          },
          nutritionReliable: {
            type: Type.BOOLEAN,
            description: 'False if dish/nutrition cannot be reliably estimated from the photo.',
          },
          portionGrams: { type: Type.NUMBER },
          caloriesKcal: { type: Type.NUMBER },
          proteinGrams: { type: Type.NUMBER },
          carbsGrams: { type: Type.NUMBER },
          fatGrams: { type: Type.NUMBER },
          fiberGrams: { type: Type.NUMBER },
          preparationNote: { type: Type.STRING },
        },
        required: [
          'name',
          'hindiName',
          'regionalCuisine',
          'cookingMethod',
          'keyIngredients',
          'oilGheeSugarNote',
          'nutritionReliable',
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
        summary: { type: Type.STRING },
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
    },
  },
  required: [
    'identificationStatus',
    'confidence',
    'clarificationQuestion',
    'mealTitle',
    'cuisineRegion',
    'estimatedServingSizeGrams',
    'servingDescription',
    'totals',
    'items',
    'dietSuggestions',
    'estimationDisclaimer',
  ],
};

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

function round1(val: number): number {
  return Math.round((Number.isFinite(val) ? Math.max(0, val) : 0) * 10) / 10;
}

function roundInt(val: number): number {
  return Math.round(Number.isFinite(val) ? Math.max(0, val) : 0);
}

interface RawGeminiItem extends DetectedFoodItem {
  nutritionReliable?: boolean;
}

interface RawGeminiAnalysis extends Omit<FoodAnalysisResult, 'items'> {
  items: RawGeminiItem[];
}

function parseModelJson(rawText: string): RawGeminiAnalysis {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
  }

  try {
    return JSON.parse(cleaned) as RawGeminiAnalysis;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as RawGeminiAnalysis;
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
  if (s === 500 || s === 502 || s === 503 || s === 504) return true;
  if (!s && /fetch|network|timeout|ECONNRESET|ETIMEDOUT|empty/i.test(extracted.message)) {
    return true;
  }
  return false;
}

export function sanitizeAndGroundResult(raw: RawGeminiAnalysis): FoodAnalysisResult {
  const status =
    raw.identificationStatus === 'needs_clarification' || raw.identificationStatus === 'not_food'
      ? raw.identificationStatus
      : 'identified';

  const confidence =
    raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : 'medium';

  const items: DetectedFoodItem[] = Array.isArray(raw.items)
    ? raw.items.slice(0, 10).map((item) => {
        const rawName = String(item.name || 'Food item').trim();
        const rawHindi = String(item.hindiName || '').trim();
        const refMatch =
          findIndianFoodReference(rawName) ||
          (rawHindi ? findIndianFoodReference(rawHindi) : null);

        const portionGrams =
          roundInt(item.portionGrams) > 0
            ? roundInt(item.portionGrams)
            : refMatch?.defaultPortionGrams || 0;

        const keyIngredients = Array.isArray(item.keyIngredients)
          ? item.keyIngredients.map((ing) => String(ing).trim()).filter(Boolean).slice(0, 6)
          : [];

        const geminiCalories = roundInt(item.caloriesKcal);
        const geminiProtein = round1(item.proteinGrams);
        const geminiCarbs = round1(item.carbsGrams);
        const geminiFat = round1(item.fatGrams);
        const geminiFiber = round1(item.fiberGrams);
        const hasGeminiNutrition =
          geminiCalories > 0 || geminiProtein > 0 || geminiCarbs > 0 || geminiFat > 0;

        if (item.nutritionReliable === false || (!refMatch && !hasGeminiNutrition)) {
          return {
            name: rawName,
            hindiName: rawHindi || undefined,
            regionalCuisine: String(item.regionalCuisine || '').trim() || undefined,
            cookingMethod: String(item.cookingMethod || '').trim() || 'Uncertain preparation',
            keyIngredients,
            oilGheeSugarNote:
              String(item.oilGheeSugarNote || '').trim() ||
              'Reliable nutrition data unavailable — edit dish name or add preparation details.',
            nutritionSource: 'unavailable',
            confidence: 'low',
            portionGrams,
            caloriesKcal: 0,
            proteinGrams: 0,
            carbsGrams: 0,
            fatGrams: 0,
            fiberGrams: 0,
            preparationNote:
              String(item.preparationNote || '').trim() || 'Uncertain — review before saving',
          };
        }

        if (refMatch && portionGrams > 0) {
          const refMacros = computeMacrosFromReference(refMatch, portionGrams);
          const ratio =
            refMacros.caloriesKcal > 0 && geminiCalories > 0
              ? geminiCalories / refMacros.caloriesKcal
              : 0;
          // Preserve Gemini visual oil/ghee/cream nuance within ±35% of verified reference density;
          // otherwise anchor directly to verified IFCT/USDA cooked baseline.
          const withinVisualRange = ratio >= 0.65 && ratio <= 1.4;

          return {
            name: rawName,
            hindiName: rawHindi || refMatch.hindiName,
            regionalCuisine:
              String(item.regionalCuisine || '').trim() || refMatch.regionalCuisine,
            cookingMethod:
              String(item.cookingMethod || '').trim() || refMatch.defaultCookingMethod,
            keyIngredients:
              keyIngredients.length > 0 ? keyIngredients : refMatch.defaultIngredients,
            oilGheeSugarNote:
              String(item.oilGheeSugarNote || '').trim() || refMatch.defaultOilGheeSugarNote,
            nutritionSource: 'reference_db',
            referenceFoodId: refMatch.id,
            confidence,
            portionGrams,
            caloriesKcal: withinVisualRange ? geminiCalories : refMacros.caloriesKcal,
            proteinGrams: withinVisualRange ? geminiProtein : refMacros.proteinGrams,
            carbsGrams: withinVisualRange ? geminiCarbs : refMacros.carbsGrams,
            fatGrams: withinVisualRange ? geminiFat : refMacros.fatGrams,
            fiberGrams: withinVisualRange ? geminiFiber : refMacros.fiberGrams,
            preparationNote:
              String(item.preparationNote || '').trim() ||
              `${refMatch.defaultCookingMethod} (${portionGrams} g)`,
          };
        }

        return {
          name: rawName,
          hindiName: rawHindi || undefined,
          regionalCuisine: String(item.regionalCuisine || '').trim() || undefined,
          cookingMethod: String(item.cookingMethod || '').trim() || undefined,
          keyIngredients,
          oilGheeSugarNote: String(item.oilGheeSugarNote || '').trim() || undefined,
          nutritionSource: 'gemini_estimate',
          confidence,
          portionGrams,
          caloriesKcal: geminiCalories,
          proteinGrams: geminiProtein,
          carbsGrams: geminiCarbs,
          fatGrams: geminiFat,
          fiberGrams: geminiFiber,
          preparationNote: String(item.preparationNote || 'Estimated preparation').trim(),
        };
      })
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

  const hasUnavailableItem = items.some((item) => item.nutritionSource === 'unavailable');
  const requiresUserConfirmation =
    status === 'identified' && (confidence === 'low' || hasUnavailableItem);

  const rawServingGrams = roundInt(raw.estimatedServingSizeGrams);
  const rawCalories = roundInt(raw.totals?.caloriesKcal ?? 0);

  // When items exist, keep total meal nutrition strictly consistent with the sum of items
  const totals =
    items.length > 0 && status === 'identified'
      ? {
          caloriesKcal: roundInt(sumItems.caloriesKcal),
          proteinGrams: round1(sumItems.proteinGrams),
          carbsGrams: round1(sumItems.carbsGrams),
          fatGrams: round1(sumItems.fatGrams),
          fiberGrams: round1(sumItems.fiberGrams),
        }
      : {
          caloriesKcal: rawCalories,
          proteinGrams: round1(raw.totals?.proteinGrams ?? 0),
          carbsGrams: round1(raw.totals?.carbsGrams ?? 0),
          fatGrams: round1(raw.totals?.fatGrams ?? 0),
          fiberGrams: round1(raw.totals?.fiberGrams ?? 0),
        };

  return {
    identificationStatus: status,
    confidence,
    requiresUserConfirmation,
    clarificationQuestion: String(raw.clarificationQuestion || '').trim(),
    mealTitle: String(raw.mealTitle || (items[0]?.name ? items[0].name : 'Analyzed Meal')).trim(),
    cuisineRegion: String(raw.cuisineRegion || '').trim() || undefined,
    estimatedServingSizeGrams:
      items.length > 0 && sumItems.portionGrams > 0
        ? roundInt(sumItems.portionGrams)
        : rawServingGrams,
    servingDescription:
      String(raw.servingDescription || '').trim() ||
      (sumItems.portionGrams > 0 ? `Approx. ${roundInt(sumItems.portionGrams)} g total serving` : ''),
    totals,
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
      'Values are approximate AI & Indian nutrition reference estimates—not exact lab values. Hidden oil, ghee, butter, cream, or sugar can shift actual calories.',
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
      'The AI nutrition service is temporarily experiencing high demand. Please retry in a few seconds.',
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

const INDIAN_VISION_SYSTEM_INSTRUCTION = `Expert Indian & global culinary nutrition vision analyst for RosoFood AI.
Analyze the food image carefully and return compact structured JSON.

INDIAN FOOD & REGIONAL RECOGNITION RULES:
1. Recognize multiple items separately on a thali/plate (up to 10 items):
   - Breads: Roti, chapati, phulka, plain/aloo/sattu paratha, tandoori/butter naan, poori, bhatura, litti.
   - Lentils/Curries: Dal tadka, dal makhani, rajma, chole, kadhi pakora, sambar, rasam.
   - Rice dishes: Steamed rice/chawal, jeera rice, veg pulao, veg/chicken biryani, moong dal khichdi.
   - Paneer/Sabzi: Palak paneer, paneer butter masala, kadai/matar paneer, aloo gobi, bhindi, baingan bharta/chokha, sarson ka saag, mix veg.
   - South Indian: Masala/plain/rava dosa, idli, medu vada, uttapam, poha, upma, pongal, coconut/tomato chutney.
   - Regional & Snacks: Bihari litti chokha & sattu paratha, Bengali macher jhol/aloo posto/rasgulla/mishti doi, Punjabi sarson saag/chole bhature, Gujarati dhokla, samosa, pakora/bhajiya, vada pav, chaat.
   - Indian Sweets & Drinks: Gulab jamun, jalebi, rasgulla, ladoo, kheer, masala chai, lassi, chaas, coconut water, Indian fruits.
2. Provide English dish name ("name") and Devanagari Hindi name ("hindiName", e.g., "दाल तड़का") for Indian dishes. Also accept/understand Hindi/Hinglish clarification details from the user.
3. For every visible item: estimate realistic cooked portionGrams, identify cookingMethod, up to 5 keyIngredients, and oilGheeSugarNote accounting for visible ghee/butter glaze, oil sheen, creamy cashew gravy, deep frying, or sugar syrup.
4. Safety & Honesty:
   - Never claim exact calories; note estimates in estimationDisclaimer.
   - If the photo is blurry, covered, too dark, or an ambiguous curry/sweet where guessing risks inventing the wrong dish (and user hasn't clarified), set identificationStatus="needs_clarification", confidence="low", empty items, zero totals, and ask a clear clarificationQuestion.
   - If a specific item's nutrition cannot be reliably determined, set nutritionReliable=false and zero macros for that item rather than inventing numbers.
   - If there is no food in the image, set identificationStatus="not_food", confidence="low", zero totals, empty items.
5. Keep dietSuggestions helpful for Indian/global eating habits (1-2 practical healthier swaps & protein options).`;

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

  const promptText = userClarification
    ? `Identify every food item on this plate using user note "${userClarification}" (may be English/Hindi/Hinglish). Estimate portion grams, ingredients, cooking method, visible oil/ghee/sugar, and nutrition JSON.`
    : `Identify every food item on this plate (Indian or international), including regional dish names and Hindi names where applicable. Estimate portion grams, ingredients, cooking method, visible oil/ghee/sugar, and nutrition JSON.`;

  const modelCandidates = [
    {
      model: 'gemini-4-hydrogen',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    {
      model: 'gemini-3.1-flash-lite',
      thinkingConfig: undefined,
    },
  ];
  let lastError: unknown;

  for (const candidate of modelCandidates) {
    try {

      const response = await withTimeout(
        ai.models.generateContent({
          model: candidate.model,
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
            systemInstruction: INDIAN_VISION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: analysisResponseSchema,
            ...(candidate.thinkingConfig ? { thinkingConfig: candidate.thinkingConfig } : {}),
          },
        }),
        GEMINI_TIMEOUT_MS,
        'Food analysis timed out. Please try again.'
      );

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
      return sanitizeAndGroundResult(parsed);
    } catch (error: unknown) {
      lastError = error;
      const extracted = extractErrorDetails(error, 'Failed to analyze food image with Gemini Vision.');

      if (
        extracted.status === 400 ||
        extracted.status === 401 ||
        extracted.status === 403 ||
        extracted.status === 404 ||
        extracted.status === 504 ||
        !isRetryableFailure(error, extracted)
      ) {
        break;
      }
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

  const systemInstruction = `Indian & global culinary nutrition analyst for RosoFood AI. Understand English, Hindi (Devanagari/Hinglish), and regional Indian dish names. Break multi-item meals into individual items (up to 10), include hindiName, regionalCuisine, cookingMethod, keyIngredients, and oilGheeSugarNote. Account for cooking oil, ghee, butter, and sugar. If input is not food, set identificationStatus="not_food" with zero totals. Keep dietSuggestions concise.`;

  const promptText = `Estimate structured JSON nutrition and diet tips for: "${trimmed}"`;

  const modelCandidates = [
    {
      model: 'gemini-4-hydrogen',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    {
      model: 'gemini-3.1-flash-lite',
      thinkingConfig: undefined,
    },
  ];
  let lastError: unknown;

  for (const candidate of modelCandidates) {
    try {

      const response = await withTimeout(
        ai.models.generateContent({
          model: candidate.model,
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: analysisResponseSchema,
            ...(candidate.thinkingConfig ? { thinkingConfig: candidate.thinkingConfig } : {}),
          },
        }),
        GEMINI_TIMEOUT_MS,
        'Food nutrition estimation timed out. Please try again.'
      );

      const jsonText = (response.text ?? '').trim();
      if (!jsonText) {
        throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
      }

      const parsed = parseModelJson(jsonText);
      return sanitizeAndGroundResult(parsed);
    } catch (error: unknown) {
      lastError = error;
      const extracted = extractErrorDetails(error, 'Failed to estimate nutrition for this food.');

      if (
        extracted.status === 400 ||
        extracted.status === 401 ||
        extracted.status === 403 ||
        extracted.status === 404 ||
        extracted.status === 504 ||
        !isRetryableFailure(error, extracted)
      ) {
        break;
      }
    }
  }

  throwMappedUpstreamError(lastError, 'Failed to estimate nutrition for this food.');
}
