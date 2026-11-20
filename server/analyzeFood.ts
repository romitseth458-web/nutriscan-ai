import { GoogleGenAI, Type, type Schema } from '@google/genai';
import type { FoodAnalysisResult } from '../src/types/nutrition.ts';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

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

function normalizeMimeType(mimeType: string): 'image/jpeg' | 'image/png' {
  const normalized = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    throw new ValidationError(
      'Unsupported image format. Please upload a JPG, JPEG, or PNG image.'
    );
  }
  return normalized === 'image/png' ? 'image/png' : 'image/jpeg';
}

function validateImageBytes(base64Data: string, mimeType: 'image/jpeg' | 'image/png'): string {
  const cleaned = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
  if (!cleaned) {
    throw new ValidationError('No image data was received.');
  }

  // Approximate decoded size check before full decode
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

  // Magic-byte verification so non-image files renamed to .jpg/.png are rejected
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (mimeType === 'image/jpeg' && !isJpeg) {
    throw new ValidationError('File content does not match a valid JPEG image.');
  }
  if (mimeType === 'image/png' && !isPng) {
    throw new ValidationError('File content does not match a valid PNG image.');
  }

  return cleaned;
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

  return {
    identificationStatus: status,
    confidence,
    clarificationQuestion: String(raw.clarificationQuestion || '').trim(),
    mealTitle: String(raw.mealTitle || 'Analyzed Meal').trim(),
    estimatedServingSizeGrams: roundInt(raw.estimatedServingSizeGrams),
    servingDescription: String(raw.servingDescription || '').trim(),
    totals: {
      caloriesKcal: roundInt(raw.totals?.caloriesKcal ?? 0),
      proteinGrams: round1(raw.totals?.proteinGrams ?? 0),
      carbsGrams: round1(raw.totals?.carbsGrams ?? 0),
      fatGrams: round1(raw.totals?.fatGrams ?? 0),
      fiberGrams: round1(raw.totals?.fiberGrams ?? 0),
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

export interface AnalyzeFoodInput {
  imageBase64: string;
  mimeType: string;
  clarification?: string;
}

export async function analyzeFoodImage(input: AnalyzeFoodInput): Promise<FoodAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new UpstreamApiError(
      'Server Gemini API key is not configured. Add GEMINI_API_KEY in environment secrets.',
      500
    );
  }

  const normalizedMime = normalizeMimeType(input.mimeType);
  const cleanBase64 = validateImageBytes(input.imageBase64, normalizedMime);
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
                  mimeType: normalizedMime,
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

        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
          throw new UpstreamApiError('Gemini returned an empty response. Please try again.', 502);
        }

        const parsed = JSON.parse(jsonText) as FoodAnalysisResult;
        return sanitizeResult(parsed);
      } catch (error: unknown) {
        lastError = error;
        const errObj = error as { status?: number; message?: string };
        const status = errObj?.status;

        // Do not retry non-transient auth/input errors
        if (status === 400 || status === 401 || status === 403 || status === 404) {
          shouldTryNextModel = false;
          break;
        }
        if (status === 503 || status === 429) {
          shouldTryNextModel = true;
        }
        if (attempt < 1) {
          await sleep(450 * (attempt + 1));
        }
      }
    }

    if (!shouldTryNextModel) {
      break;
    }
  }

  const errObj = lastError as { status?: number; message?: string };
  const status = errObj?.status;
  let message = errObj?.message || 'Failed to analyze food image with Gemini Vision.';

  // Extract inner message if the SDK returned a JSON error payload string
  try {
    const parsedErr = JSON.parse(message) as { error?: { message?: string; code?: number } };
    if (parsedErr?.error?.message) {
      message = parsedErr.error.message;
    }
  } catch {
    // Keep original message
  }

  if (status === 429) {
    throw new UpstreamApiError(
      'Rate limit reached on the AI service. Please wait a moment and try again.',
      429
    );
  }
  if (status === 503) {
    throw new UpstreamApiError(
      'The AI vision model is experiencing temporary high demand. Please retry in a few seconds.',
      503
    );
  }
  if (status === 403 || status === 401) {
    throw new UpstreamApiError(
      'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.',
      403
    );
  }
  if (lastError instanceof UpstreamApiError || lastError instanceof ValidationError) {
    throw lastError;
  }

  throw new UpstreamApiError(message, 502);
}

export async function analyzeFoodText(query: string): Promise<FoodAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new UpstreamApiError(
      'Server Gemini API key is not configured. Add GEMINI_API_KEY in environment secrets.',
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

        const parsed = JSON.parse(jsonText) as FoodAnalysisResult;
        return sanitizeResult(parsed);
      } catch (error: unknown) {
        lastError = error;
        const errObj = error as { status?: number; message?: string };
        const status = errObj?.status;

        if (status === 400 || status === 401 || status === 403 || status === 404) {
          shouldTryNextModel = false;
          break;
        }
        if (status === 503 || status === 429) {
          shouldTryNextModel = true;
        }
        if (attempt < 1) {
          await sleep(450 * (attempt + 1));
        }
      }
    }

    if (!shouldTryNextModel) {
      break;
    }
  }

  const errObj = lastError as { status?: number; message?: string };
  const status = errObj?.status;
  let message = errObj?.message || 'Failed to estimate nutrition for this food.';

  try {
    const parsedErr = JSON.parse(message) as { error?: { message?: string } };
    if (parsedErr?.error?.message) {
      message = parsedErr.error.message;
    }
  } catch {
    // Keep original message
  }

  if (status === 429) {
    throw new UpstreamApiError(
      'Rate limit reached on the AI service. Please wait a moment and try again.',
      429
    );
  }
  if (status === 503) {
    throw new UpstreamApiError(
      'The AI service is experiencing temporary high demand. Please retry in a few seconds.',
      503
    );
  }
  if (lastError instanceof UpstreamApiError || lastError instanceof ValidationError) {
    throw lastError;
  }

  throw new UpstreamApiError(message, 502);
}
