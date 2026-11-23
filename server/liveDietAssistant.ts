import type { IncomingMessage, Server as HttpServer } from 'http';
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import type { UserDietAssistantContext } from '../src/utils/dietContext.ts';
import {
  buildSystemInstruction,
  DEFAULT_VOICE_NAME,
  extractLiveErrorMessage,
  LIVE_MODEL,
  sanitizeContext,
  sanitizeDailyGoalsArgs,
  sanitizeDietProfileArgs,
  updateDailyGoalsTool,
  updateDietProfileTool,
  verifyFirebaseIdToken,
} from './dietAssistantShared.ts';

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function setupLiveDietAssistantWebSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024, // 1 MB per message
  });

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const rawUrl = req.url || '/';
    let pathname = '/';
    try {
      pathname = new URL(rawUrl, 'http://localhost').pathname;
    } catch {
      return;
    }

    if (pathname !== '/api/live-assistant') {
      // Leave Vite HMR and all other upgrade paths untouched
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let session: Session | null = null;
    let isInitialized = false;
    let isClosed = false;
    let activeContext: UserDietAssistantContext | null = null;

    const initTimeout = setTimeout(() => {
      if (!isInitialized && !isClosed) {
        sendJson(clientWs, {
          type: 'error',
          code: 'INIT_TIMEOUT',
          message: 'Voice assistant session timed out before authentication completed.',
        });
        clientWs.close(4001, 'Initialization timeout');
      }
    }, 15_000);

    function cleanup() {
      if (isClosed) return;
      isClosed = true;
      clearTimeout(initTimeout);
      if (session) {
        try {
          session.close();
        } catch {
          // Ignore close error
        }
        session = null;
      }
    }

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    clientWs.on('message', async (rawData) => {
      if (isClosed) return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        sendJson(clientWs, {
          type: 'error',
          code: 'BAD_MESSAGE',
          message: 'Malformed WebSocket message.',
        });
        return;
      }

      if (msg.type === 'init') {
        if (isInitialized) return;
        isInitialized = true;
        clearTimeout(initTimeout);

        try {
          const idToken = typeof msg.idToken === 'string' ? msg.idToken : '';
          await verifyFirebaseIdToken(idToken);
        } catch (authError) {
          sendJson(clientWs, {
            type: 'error',
            code: 'UNAUTHORIZED',
            message:
              authError instanceof Error
                ? authError.message
                : 'Authentication required to start voice call.',
          });
          clientWs.close(4003, 'Unauthorized');
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
          sendJson(clientWs, {
            type: 'error',
            code: 'NO_API_KEY',
            message:
              'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
          });
          clientWs.close(4500, 'Missing GEMINI_API_KEY');
          return;
        }

        activeContext = sanitizeContext(msg.context);

        try {
          // Live API BidiGenerateContent requires v1beta (SDK v3.6+ defaults to v1)
          const ai = new GoogleGenAI({
            apiKey,
            apiVersion: 'v1beta',
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const liveSession = await ai.live.connect({
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
              tools: [{ functionDeclarations: [updateDietProfileTool, updateDailyGoalsTool] }],
              systemInstruction: buildSystemInstruction(activeContext),
            },
            callbacks: {
              onopen: () => {
                sendJson(clientWs, { type: 'ready' });
              },
              onmessage: (message: LiveServerMessage) => {
                if (isClosed) return;
                const content = message.serverContent;

                if (content?.inputTranscription?.text) {
                  sendJson(clientWs, {
                    type: 'input_transcript',
                    text: content.inputTranscription.text,
                  });
                }

                if (content?.outputTranscription?.text) {
                  sendJson(clientWs, {
                    type: 'output_transcript',
                    text: content.outputTranscription.text,
                  });
                }

                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    sendJson(clientWs, {
                      type: 'audio',
                      audio: part.inlineData.data,
                    });
                  }
                }

                if (content?.interrupted) {
                  sendJson(clientWs, { type: 'interrupted' });
                }

                if (content?.turnComplete) {
                  sendJson(clientWs, { type: 'turn_complete' });
                }

                const toolCalls = message.toolCall?.functionCalls;
                if (toolCalls && toolCalls.length > 0 && session) {
                  const responses = toolCalls.map((call) => {
                    const args = (call.args || {}) as Record<string, unknown>;

                    if (call.name === 'update_user_diet_profile') {
                      const partialProfile = sanitizeDietProfileArgs(args);
                      if (activeContext) {
                        activeContext = {
                          ...activeContext,
                          dietProfile: { ...activeContext.dietProfile, ...partialProfile },
                        };
                      }
                      sendJson(clientWs, {
                        type: 'tool_profile_update',
                        dietProfile: partialProfile,
                      });
                      return {
                        id: call.id,
                        name: call.name,
                        response: {
                          saved: true,
                          updatedFields: partialProfile,
                        },
                      };
                    }

                    if (call.name === 'update_daily_goals') {
                      const nextGoals = sanitizeDailyGoalsArgs(
                        args,
                        activeContext?.dailyGoals || {
                          caloriesKcal: 2000,
                          proteinGrams: 120,
                          carbsGrams: 225,
                          fatGrams: 65,
                          fiberGrams: 30,
                        }
                      );
                      if (activeContext) {
                        activeContext = { ...activeContext, dailyGoals: nextGoals };
                      }
                      sendJson(clientWs, {
                        type: 'tool_goals_update',
                        dailyGoals: nextGoals,
                      });
                      return {
                        id: call.id,
                        name: call.name,
                        response: {
                          saved: true,
                          dailyGoals: nextGoals,
                        },
                      };
                    }

                    return {
                      id: call.id,
                      name: call.name,
                      response: { error: 'Unknown tool name.' },
                    };
                  });

                  session.sendToolResponse({ functionResponses: responses });
                }
              },
              onerror: (err) => {
                if (isClosed) return;
                const detailed = extractLiveErrorMessage(
                  err,
                  'Gemini Live WebSocket connection failed.'
                );
                if (process.env.NODE_ENV !== 'production') {
                  console.error('[RosoFood LiveProxy] Upstream onerror:', detailed, err);
                }
                sendJson(clientWs, {
                  type: 'error',
                  code: 'LIVE_API_ERROR',
                  message: detailed,
                });
              },
              onclose: (event) => {
                if (process.env.NODE_ENV !== 'production') {
                  console.info('[RosoFood LiveProxy] Upstream closed:', {
                    code: event?.code,
                    reason: event?.reason,
                  });
                }
                if (!isClosed) {
                  if (event && event.code !== 1000 && event.code !== 1005) {
                    const reasonMsg = event.reason
                      ? `Gemini Live closed (${event.code}): ${event.reason}`
                      : `Gemini Live disconnected unexpectedly (code ${event.code}).`;
                    sendJson(clientWs, {
                      type: 'error',
                      code: 'LIVE_CLOSED_ABNORMAL',
                      message: reasonMsg,
                    });
                  } else {
                    sendJson(clientWs, { type: 'closed' });
                  }
                  clientWs.close();
                }
              },
            },
          });

          if (isClosed) {
            liveSession.close();
            return;
          }

          session = liveSession;
          sendJson(clientWs, { type: 'connected' });

          if (msg.autoGreet !== false) {
            const langHint =
              activeContext.preferredLanguage === 'hindi'
                ? 'Speak in Hindi.'
                : activeContext.preferredLanguage === 'hinglish'
                  ? 'Speak in natural Hinglish.'
                  : 'Speak naturally in English (and let them know Hindi or Hinglish also works).';

            liveSession.sendRealtimeInput({
              text: `The voice call just connected. Greet ${activeContext.displayName} warmly in 2 brief sentences, mention their actual today logged calorie status (${activeContext.todaySummary.mealCount} meals, ${activeContext.todaySummary.totals.caloriesKcal} kcal out of ${activeContext.dailyGoals.caloriesKcal} kcal goal), and ask how you can help with their diet today. ${langHint}`,
            });
          }
        } catch (connectErr) {
          const message = extractLiveErrorMessage(
            connectErr,
            'Unable to start Gemini Live voice session.'
          );
          if (process.env.NODE_ENV !== 'production') {
            console.error('[RosoFood LiveProxy] connect failed:', message, connectErr);
          }
          sendJson(clientWs, {
            type: 'error',
            code: 'LIVE_CONNECT_FAILED',
            message,
          });
          clientWs.close(4502, 'Gemini Live connection failed');
        }
        return;
      }

      if (!session) return;

      if (msg.type === 'audio' && typeof msg.audio === 'string' && msg.audio.length > 0) {
        session.sendRealtimeInput({
          audio: {
            data: msg.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
        return;
      }

      if (msg.type === 'text' && typeof msg.text === 'string') {
        const cleanText = msg.text.trim().slice(0, 600);
        if (cleanText) {
          session.sendRealtimeInput({ text: cleanText });
        }
        return;
      }

      if (msg.type === 'context_update' && msg.context) {
        activeContext = sanitizeContext(msg.context);
        session.sendRealtimeInput({
          text: `[SYSTEM UPDATE: The user updated their profile or targets in the app. Updated profile: ${JSON.stringify(
            activeContext.dietProfile
          )}. Updated dailyGoals: ${JSON.stringify(
            activeContext.dailyGoals
          )}. Missing fields: ${activeContext.missingProfileFields.join(', ') || 'none'}. Preferred language: ${activeContext.preferredLanguage}. Acknowledge briefly only if helpful.]`,
        });
      }
    });
  });
}
