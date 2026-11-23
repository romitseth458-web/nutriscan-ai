import { GoogleGenAI, Modality } from '@google/genai';
import {
  buildSystemInstruction,
  DEFAULT_VOICE_NAME,
  extractLiveErrorMessage,
  LIVE_MODEL,
  LIVE_MODEL_RESOURCE,
  sanitizeContext,
  updateDailyGoalsTool,
  updateDietProfileTool,
  verifyFirebaseIdToken,
} from './dietAssistantShared.ts';

const EPHEMERAL_WS_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

export class LiveTokenError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'LiveTokenError';
    this.statusCode = statusCode;
  }
}

export interface LiveEphemeralTokenResult {
  token: string;
  wsBaseUrl: string;
  apiVersion: 'v1alpha';
  model: string;
  expireTime: string;
  newSessionExpireTime: string;
}

export async function createLiveEphemeralToken(params: {
  idToken: string;
  context?: unknown;
}): Promise<LiveEphemeralTokenResult> {
  try {
    await verifyFirebaseIdToken(params.idToken);
  } catch (authError) {
    throw new LiveTokenError(
      authError instanceof Error
        ? authError.message
        : 'Firebase authentication failed. Please sign in again.',
      401
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new LiveTokenError(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in your environment variables / Settings > Secrets.',
      500
    );
  }

  const safeContext = sanitizeContext(params.context);
  const systemInstruction = buildSystemInstruction(safeContext);

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  // Ephemeral auth tokens require apiVersion: 'v1alpha'
  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1alpha',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    const tokenResource = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: DEFAULT_VOICE_NAME },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
            tools: [
              {
                functionDeclarations: [updateDietProfileTool, updateDailyGoalsTool],
              },
            ],
          },
        },
      },
    });

    if (!tokenResource?.name) {
      throw new LiveTokenError(
        'Gemini API returned an empty ephemeral token response.',
        502
      );
    }

    return {
      token: tokenResource.name,
      wsBaseUrl: EPHEMERAL_WS_BASE_URL,
      apiVersion: 'v1alpha',
      model: LIVE_MODEL_RESOURCE,
      expireTime,
      newSessionExpireTime,
    };
  } catch (err) {
    if (err instanceof LiveTokenError) {
      throw err;
    }

    const rawMessage = extractLiveErrorMessage(
      err,
      'Failed to create ephemeral Gemini Live session token.'
    );

    if (process.env.NODE_ENV !== 'production') {
      console.error('[RosoFood LiveToken] authTokens.create failed:', rawMessage, err);
    }

    if (/401|403|PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(rawMessage)) {
      throw new LiveTokenError(
        'Gemini API authentication failed. Please check GEMINI_API_KEY in Settings > Secrets or Vercel Environment Variables.',
        403
      );
    }
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
      throw new LiveTokenError(
        'Gemini Live API quota or rate limit reached. Please wait a moment and retry.',
        429
      );
    }
    if (/404|NOT_FOUND/i.test(rawMessage)) {
      throw new LiveTokenError(
        `Gemini Live model "${LIVE_MODEL}" is currently unavailable on this endpoint: ${rawMessage}`,
        502
      );
    }
    if (/503|UNAVAILABLE/i.test(rawMessage)) {
      throw new LiveTokenError(
        'Gemini Live service is temporarily busy. Please retry in a few seconds.',
        503
      );
    }

    throw new LiveTokenError(rawMessage, 502);
  }
}
