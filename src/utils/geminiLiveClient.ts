import type {
  DailyNutritionGoals,
  DietActivityLevel,
  DietaryPreference,
  DietFitnessGoal,
  UserDietProfile,
} from '../types/nutrition';
import type { UserDietAssistantContext } from './dietContext';

export interface LiveTokenResponse {
  token: string;
  wsBaseUrl: string;
  apiVersion: 'v1alpha';
  model: string;
  expireTime: string;
  newSessionExpireTime: string;
}

export interface GeminiLiveClientHandlers {
  onConnected: () => void;
  onAudioOutput: (base64Pcm24k: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onToolProfileUpdate: (partialProfile: UserDietProfile) => void;
  onToolGoalsUpdate: (nextGoals: DailyNutritionGoals) => void;
  onError: (message: string) => void;
  onClosed: (reason?: string) => void;
}

const TOKEN_FETCH_TIMEOUT_MS = 12_000;
const WS_CONNECT_TIMEOUT_MS = 15_000;

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

function sanitizeClientProfileArgs(args: Record<string, unknown>): UserDietProfile {
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

function sanitizeClientGoalsArgs(
  args: Record<string, unknown>,
  fallback: DailyNutritionGoals
): DailyNutritionGoals {
  const clamp = (val: unknown, min: number, max: number, def: number): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return def;
    return Math.round(Math.min(max, Math.max(min, n)));
  };

  return {
    caloriesKcal: clamp(args.caloriesKcal, 1200, 8000, Math.max(1200, fallback.caloriesKcal)),
    proteinGrams: clamp(args.proteinGrams, 30, 500, fallback.proteinGrams),
    carbsGrams: clamp(args.carbsGrams, 30, 1000, fallback.carbsGrams),
    fatGrams: clamp(args.fatGrams, 20, 400, fallback.fatGrams),
    fiberGrams: clamp(args.fiberGrams, 10, 150, fallback.fiberGrams),
  };
}

async function decodeWsPayload(data: unknown): Promise<string | null> {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Blob) {
    return data.text();
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }
  return null;
}

function formatCloseError(code: number, reason: string, duringHandshake: boolean): string {
  const cleanReason = reason.trim();
  if (code === 1008 || /invalid|unauthorized|permission|auth|token/i.test(cleanReason)) {
    return cleanReason
      ? `Gemini Live authentication rejected (${code}): ${cleanReason}`
      : `Gemini Live authentication was rejected (code ${code}). Tap Retry Call.`;
  }
  if (code === 1013 || /quota|resource_exhausted|rate/i.test(cleanReason)) {
    return cleanReason || 'Gemini Live service is busy or quota-limited right now. Please retry shortly.';
  }
  if (duringHandshake) {
    return cleanReason
      ? `Gemini Live handshake failed (code ${code}): ${cleanReason}`
      : `Unable to establish Gemini Live connection (WebSocket closed with code ${code}).`;
  }
  return cleanReason
    ? `Voice call disconnected (code ${code}): ${cleanReason}`
    : `Voice call disconnected unexpectedly (code ${code}). Tap Retry Call to reconnect.`;
}

export async function fetchLiveEphemeralToken(
  idToken: string,
  context: UserDietAssistantContext
): Promise<LiveTokenResponse> {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), TOKEN_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/live-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ context }),
      signal: controller.signal,
    });

    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    if (!response.ok) {
      const serverErr =
        typeof body.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `Token endpoint returned HTTP ${response.status}.`;
      throw new Error(serverErr);
    }

    if (
      typeof body.token !== 'string' ||
      !body.token ||
      typeof body.wsBaseUrl !== 'string' ||
      !body.wsBaseUrl ||
      typeof body.model !== 'string' ||
      !body.model
    ) {
      throw new Error('Server returned an incomplete Gemini Live session token payload.');
    }

    return body as unknown as LiveTokenResponse;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Timed out requesting a secure voice session token from the server. Check your connection and tap Retry Call.'
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timerId);
  }
}

export class GeminiLiveBrowserClient {
  private ws: WebSocket | null = null;
  private setupReady = false;
  private closedManually = false;
  private connectTimeoutId: number | null = null;
  private parseQueue: Promise<void> = Promise.resolve();
  private activeContext: UserDietAssistantContext;
  private handlers: GeminiLiveClientHandlers;

  constructor(context: UserDietAssistantContext, handlers: GeminiLiveClientHandlers) {
    this.activeContext = context;
    this.handlers = handlers;
  }

  isReady(): boolean {
    return this.setupReady && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(tokenPayload: LiveTokenResponse): void {
    this.closedManually = false;
    this.setupReady = false;

    const wsUrl = `${tokenPayload.wsBaseUrl}?access_token=${encodeURIComponent(tokenPayload.token)}`;

    if (import.meta.env.DEV) {
      console.info('[RosoFood Live] Opening Gemini Live WebSocket:', {
        apiVersion: tokenPayload.apiVersion,
        model: tokenPayload.model,
        endpoint: tokenPayload.wsBaseUrl,
      });
    }

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.connectTimeoutId = window.setTimeout(() => {
      if (!this.setupReady && !this.closedManually) {
        if (import.meta.env.DEV) {
          console.error('[RosoFood Live] WebSocket setup timed out after 15s.');
        }
        this.close();
        this.handlers.onError(
          'Gemini Live connection timed out waiting for session setup. Please check your network and tap Retry Call.'
        );
      }
    }, WS_CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      if (this.closedManually || this.ws !== ws) return;

      if (import.meta.env.DEV) {
        console.info('[RosoFood Live] WebSocket transport opened; sending constrained setup.');
      }

      // When liveConnectConstraints locks config on the ephemeral token,
      // send only the matching model in the setup frame.
      ws.send(JSON.stringify({ setup: { model: tokenPayload.model } }));
    };

    ws.onmessage = (event) => {
      if (this.closedManually || this.ws !== ws) return;
      this.parseQueue = this.parseQueue
        .then(async () => {
          if (this.closedManually || this.ws !== ws) return;
          const raw = await decodeWsPayload(event.data);
          if (!raw) return;
          this.handleServerJson(raw);
        })
        .catch((parseErr) => {
          if (import.meta.env.DEV) {
            console.error('[RosoFood Live] Failed to handle server message:', parseErr);
          }
        });
    };

    ws.onerror = (event) => {
      if (this.closedManually || this.ws !== ws) return;
      if (import.meta.env.DEV) {
        console.error('[RosoFood Live] WebSocket error event:', event);
      }
      // Wait briefly for onclose if it follows immediately with a specific code/reason,
      // otherwise clear timeout and surface connection error when socket closes.
    };

    ws.onclose = (ev) => {
      this.clearConnectTimeout();
      if (this.ws === ws) {
        this.ws = null;
      }

      if (import.meta.env.DEV) {
        console.info('[RosoFood Live] WebSocket closed:', {
          code: ev.code,
          reason: ev.reason,
          wasClean: ev.wasClean,
          setupReady: this.setupReady,
        });
      }

      if (this.closedManually) return;

      const wasSetupReady = this.setupReady;
      this.setupReady = false;

      if (!wasSetupReady || (ev.code !== 1000 && ev.code !== 1005)) {
        this.handlers.onError(formatCloseError(ev.code, ev.reason || '', !wasSetupReady));
      } else {
        this.handlers.onClosed(ev.reason || undefined);
      }
    };
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutId !== null) {
      window.clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
  }

  private handleServerJson(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (msg.error && typeof msg.error === 'object') {
      const apiErr = msg.error as { message?: unknown; status?: unknown; code?: unknown };
      const errMsg =
        typeof apiErr.message === 'string' && apiErr.message.trim()
          ? apiErr.message.trim()
          : 'Gemini Live returned a session error.';
      if (import.meta.env.DEV) {
        console.error('[RosoFood Live] Server error payload:', msg.error);
      }
      this.clearConnectTimeout();
      this.close();
      this.handlers.onError(errMsg);
      return;
    }

    if ('setupComplete' in msg) {
      this.clearConnectTimeout();
      this.setupReady = true;
      if (import.meta.env.DEV) {
        console.info('[RosoFood Live] Received setupComplete; voice session live.');
      }
      this.handlers.onConnected();
      this.sendInitialGreeting();
      return;
    }

    const serverContent = msg.serverContent as
      | {
          inputTranscription?: { text?: unknown };
          outputTranscription?: { text?: unknown };
          modelTurn?: { parts?: Array<{ inlineData?: { data?: unknown } }> };
          interrupted?: unknown;
          turnComplete?: unknown;
        }
      | undefined;

    if (serverContent) {
      if (typeof serverContent.inputTranscription?.text === 'string') {
        this.handlers.onInputTranscript(serverContent.inputTranscription.text);
      }
      if (typeof serverContent.outputTranscription?.text === 'string') {
        this.handlers.onOutputTranscript(serverContent.outputTranscription.text);
      }
      if (Array.isArray(serverContent.modelTurn?.parts)) {
        for (const part of serverContent.modelTurn.parts) {
          if (typeof part?.inlineData?.data === 'string' && part.inlineData.data.length > 0) {
            this.handlers.onAudioOutput(part.inlineData.data);
          }
        }
      }
      if (serverContent.interrupted) {
        this.handlers.onInterrupted();
      }
      if (serverContent.turnComplete) {
        this.handlers.onTurnComplete();
      }
    }

    const toolCall = msg.toolCall as
      | {
          functionCalls?: Array<{
            id?: unknown;
            name?: unknown;
            args?: unknown;
          }>;
        }
      | undefined;

    if (toolCall?.functionCalls && Array.isArray(toolCall.functionCalls) && toolCall.functionCalls.length > 0) {
      const functionResponses = toolCall.functionCalls.map((call) => {
        const callId = typeof call.id === 'string' ? call.id : undefined;
        const callName = typeof call.name === 'string' ? call.name : '';
        const args = (call.args && typeof call.args === 'object' ? call.args : {}) as Record<
          string,
          unknown
        >;

        if (callName === 'update_user_diet_profile') {
          const partialProfile = sanitizeClientProfileArgs(args);
          this.activeContext = {
            ...this.activeContext,
            dietProfile: {
              ...(this.activeContext.dietProfile || {}),
              ...partialProfile,
            },
          };
          this.handlers.onToolProfileUpdate(partialProfile);
          return {
            id: callId,
            name: callName,
            response: {
              saved: true,
              updatedFields: partialProfile,
            },
          };
        }

        if (callName === 'update_daily_goals') {
          const nextGoals = sanitizeClientGoalsArgs(args, this.activeContext.dailyGoals);
          this.activeContext = {
            ...this.activeContext,
            dailyGoals: nextGoals,
          };
          this.handlers.onToolGoalsUpdate(nextGoals);
          return {
            id: callId,
            name: callName,
            response: {
              saved: true,
              dailyGoals: nextGoals,
            },
          };
        }

        return {
          id: callId,
          name: callName,
          response: { error: 'Unknown tool name.' },
        };
      });

      this.sendJson({
        toolResponse: {
          functionResponses,
        },
      });
    }
  }

  private sendInitialGreeting(): void {
    const langHint =
      this.activeContext.preferredLanguage === 'hindi'
        ? 'Speak in Hindi.'
        : this.activeContext.preferredLanguage === 'hinglish'
          ? 'Speak in natural Hinglish.'
          : 'Speak naturally in English (and let them know Hindi or Hinglish also works).';

    this.sendText(
      `The voice call just connected. Greet ${this.activeContext.displayName} warmly in 2 brief sentences, mention their actual today logged calorie status (${this.activeContext.todaySummary.mealCount} meals, ${this.activeContext.todaySummary.totals.caloriesKcal} kcal out of ${this.activeContext.dailyGoals.caloriesKcal} kcal goal), and ask how you can help with their diet today. ${langHint}`
    );
  }

  sendAudioPcm16k(base64Audio: string): void {
    if (!this.isReady() || !base64Audio) return;
    this.sendJson({
      realtimeInput: {
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    });
  }

  sendText(text: string): void {
    const cleanText = text.trim().slice(0, 800);
    if (!this.isReady() || !cleanText) return;
    this.sendJson({
      realtimeInput: {
        text: cleanText,
      },
    });
  }

  updateContext(nextContext: UserDietAssistantContext): void {
    this.activeContext = nextContext;
    if (!this.isReady()) return;
    this.sendText(
      `[SYSTEM UPDATE: The user updated their profile or targets in the app. Updated profile: ${JSON.stringify(
        nextContext.dietProfile
      )}. Updated dailyGoals: ${JSON.stringify(
        nextContext.dailyGoals
      )}. Missing fields: ${nextContext.missingProfileFields.join(', ') || 'none'}. Preferred language: ${nextContext.preferredLanguage}. Acknowledge briefly only if helpful.]`
    );
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  close(): void {
    this.closedManually = true;
    this.setupReady = false;
    this.clearConnectTimeout();
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client ended session');
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}
