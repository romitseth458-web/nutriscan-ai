import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  DailyNutritionGoals,
  DietActivityLevel,
  DietaryPreference,
  DietFitnessGoal,
  TrackedMealEntry,
  UserDietProfile,
} from '../types/nutrition';
import {
  buildDietAssistantContext,
  type AssistantLanguagePreference,
} from '../utils/dietContext';
import {
  createAudioContextSafe,
  MicPcmStreamer,
  Pcm24kAudioPlayer,
} from '../utils/pcmAudio';
import {
  fetchLiveEphemeralToken,
  GeminiLiveBrowserClient,
} from '../utils/geminiLiveClient';

const ASSISTANT_AVATAR_PATH = '/src/assets/images/diet_assistant_avatar_1795259213671.jpg';

type CallStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'muted'
  | 'ended'
  | 'error';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'notice';
  text: string;
  finalized: boolean;
}

interface VoiceDietAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  displayName: string;
  dailyGoals: DailyNutritionGoals;
  dietProfile?: UserDietProfile;
  trackedMeals: TrackedMealEntry[];
  selectedDateKey: string;
  onSaveDietProfile: (profile: UserDietProfile) => Promise<void>;
  onUpdateGoals: (goals: DailyNutritionGoals) => Promise<void>;
  onShowToast?: (message: string) => void;
}

const LANGUAGE_OPTIONS: Array<{ value: AssistantLanguagePreference; label: string }> = [
  { value: 'auto', label: 'Auto (Hindi / Hinglish / EN)' },
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
];

const QUICK_PROMPTS: Array<{ label: string; text: string }> = [
  {
    label: "Today's summary",
    text: "Give me a quick review of today's logged calories and macros.",
  },
  {
    label: 'Weekly summary',
    text: 'Summarize my nutrition over the last 7 days based on my saved history.',
  },
  {
    label: 'Daily diet plan',
    text: 'Create a balanced daily diet plan personalized for my goals.',
  },
  {
    label: 'Hindi diet plan',
    text: 'Mera daily diet plan aur hydration timing simple Hindi ya Hinglish me batao.',
  },
  {
    label: 'High-protein ideas',
    text: 'Suggest realistic high-protein meals and snacks matching my preference.',
  },
];

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function appendTranscriptChunk(
  list: TranscriptMessage[],
  role: 'user' | 'assistant',
  chunk: string
): TranscriptMessage[] {
  const cleanChunk = chunk;
  if (!cleanChunk) return list;

  const next = list.map((item) =>
    item.role !== role && !item.finalized ? { ...item, finalized: true } : item
  );
  const last = next[next.length - 1];

  if (last && last.role === role && !last.finalized) {
    const needsSpace =
      last.text.length > 0 &&
      !/\s$/.test(last.text) &&
      !/^[\s.,!?;:)'"]/.test(cleanChunk);
    const updatedText = `${last.text}${needsSpace ? ' ' : ''}${cleanChunk}`;
    return [...next.slice(0, -1), { ...last, text: updatedText }];
  }

  return [
    ...next,
    {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text: cleanChunk.trimStart(),
      finalized: false,
    },
  ];
}

function finalizeOpenTranscripts(list: TranscriptMessage[]): TranscriptMessage[] {
  let changed = false;
  const mapped = list.map((item) => {
    if (!item.finalized) {
      changed = true;
      return { ...item, finalized: true };
    }
    return item;
  });
  return changed ? mapped : list;
}

export function VoiceDietAssistantModal({
  isOpen,
  onClose,
  user,
  displayName,
  dailyGoals,
  dietProfile,
  trackedMeals,
  selectedDateKey,
  onSaveDietProfile,
  onUpdateGoals,
  onShowToast,
}: VoiceDietAssistantModalProps) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isInterruptedBadge, setIsInterruptedBadge] = useState(false);
  const [languagePref, setLanguagePref] = useState<AssistantLanguagePreference>('auto');
  const [callSeconds, setCallSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speakerBlocked, setSpeakerBlocked] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [waveBars, setWaveBars] = useState<number[]>(() => Array(16).fill(0.14));

  // Profile drawer editable fields
  const [ageDraft, setAgeDraft] = useState('');
  const [heightDraft, setHeightDraft] = useState('');
  const [weightDraft, setWeightDraft] = useState('');
  const [activityDraft, setActivityDraft] = useState<DietActivityLevel | ''>('');
  const [goalDraft, setGoalDraft] = useState<DietFitnessGoal | ''>('');
  const [dietPrefDraft, setDietPrefDraft] = useState<DietaryPreference | ''>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Refs for real-time audio / Gemini Live WebSocket closures
  const liveClientRef = useRef<GeminiLiveBrowserClient | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const micStreamerRef = useRef<MicPcmStreamer | null>(null);
  const playerRef = useRef<Pcm24kAudioPlayer | null>(null);
  const micLevelRef = useRef(0);
  const isMutedRef = useRef(false);
  const statusRef = useRef<CallStatus>('idle');
  const manualCloseRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const assistantContext = useMemo(
    () =>
      buildDietAssistantContext({
        displayName,
        dailyGoals,
        dietProfile,
        trackedMeals,
        selectedDateKey,
        preferredLanguage: languagePref,
      }),
    [displayName, dailyGoals, dietProfile, trackedMeals, selectedDateKey, languagePref]
  );

  const contextRef = useRef(assistantContext);
  useEffect(() => {
    contextRef.current = assistantContext;
  }, [assistantContext]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Sync profile drawer draft values with Firestore profile
  useEffect(() => {
    setAgeDraft(typeof dietProfile?.age === 'number' ? String(dietProfile.age) : '');
    setHeightDraft(
      typeof dietProfile?.heightCm === 'number' ? String(dietProfile.heightCm) : ''
    );
    setWeightDraft(
      typeof dietProfile?.weightKg === 'number' ? String(dietProfile.weightKg) : ''
    );
    setActivityDraft(dietProfile?.activityLevel || '');
    setGoalDraft(dietProfile?.fitnessGoal || '');
    setDietPrefDraft(dietProfile?.dietaryPreference || '');
  }, [
    dietProfile?.age,
    dietProfile?.heightCm,
    dietProfile?.weightKg,
    dietProfile?.activityLevel,
    dietProfile?.fitnessGoal,
    dietProfile?.dietaryPreference,
  ]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcripts]);

  // Live call duration timer
  useEffect(() => {
    const isActive =
      status === 'listening' || status === 'speaking' || status === 'muted';
    if (!isActive) return;

    const id = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Real-time audio waveform visualizer loop
  useEffect(() => {
    if (!isOpen) return;

    let rafId = 0;
    let lastTick = 0;

    const tick = (now: number) => {
      if (now - lastTick >= 55) {
        lastTick = now;
        const playerLevel = playerRef.current?.getOutputLevel() || 0;
        const micLevel = isMutedRef.current ? 0 : micLevelRef.current;
        const activeLevel = isAssistantSpeaking ? Math.max(0.18, playerLevel) : micLevel;
        const t = now / 180;

        setWaveBars(
          Array.from({ length: 16 }, (_, idx) => {
            const centerWeight = 1 - Math.abs(idx - 7.5) / 8.5;
            if (statusRef.current === 'connecting') {
              return 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t + idx * 0.55));
            }
            if (
              statusRef.current === 'idle' ||
              statusRef.current === 'ended' ||
              statusRef.current === 'error'
            ) {
              return 0.12;
            }
            if (statusRef.current === 'muted' && !isAssistantSpeaking) {
              return 0.1;
            }
            const harmonic = 0.65 + 0.35 * Math.sin(t * 1.4 + idx * 0.8);
            const height = 0.12 + activeLevel * centerWeight * harmonic * 0.88;
            return Math.min(1, Math.max(0.1, height));
          })
        );
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, isAssistantSpeaking]);

  const teardownSession = useCallback(() => {
    sessionGenerationRef.current += 1;
    manualCloseRef.current = true;
    micLevelRef.current = 0;

    if (micStreamerRef.current) {
      micStreamerRef.current.stop();
      micStreamerRef.current = null;
    }

    if (playerRef.current) {
      playerRef.current.stopAll();
      playerRef.current = null;
    }

    if (liveClientRef.current) {
      liveClientRef.current.close();
      liveClientRef.current = null;
    }

    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    setIsAssistantSpeaking(false);
    setSpeakerBlocked(false);
  }, []);

  const startCall = useCallback(async () => {
    teardownSession();
    const generation = sessionGenerationRef.current;
    manualCloseRef.current = false;
    setErrorMessage(null);
    setIsInterruptedBadge(false);
    setIsMuted(false);
    isMutedRef.current = false;
    setCallSeconds(0);
    setStatus('connecting');
    setTranscripts([]);

    const isStale = () => manualCloseRef.current || sessionGenerationRef.current !== generation;

    // 1. Initialize & resume Web Audio contexts inside interaction flow
    let inputCtx: AudioContext;
    let outputCtx: AudioContext;
    try {
      inputCtx = createAudioContextSafe(16000);
      outputCtx = createAudioContextSafe(24000);
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      if (inputCtx.state === 'suspended') {
        await inputCtx.resume().catch(() => {});
      }
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume().catch(() => {});
      }
    } catch {
      setErrorMessage('Audio system could not be initialized on this browser.');
      setStatus('error');
      teardownSession();
      return;
    }

    if (isStale()) return;

    const player = new Pcm24kAudioPlayer(outputCtx, (speaking) => {
      setIsAssistantSpeaking(speaking);
      setStatus((curr) => {
        if (curr === 'error' || curr === 'ended' || curr === 'idle' || curr === 'connecting') {
          return curr;
        }
        if (speaking) return 'speaking';
        return isMutedRef.current ? 'muted' : 'listening';
      });
    });
    playerRef.current = player;

    // 2. Get Firebase Auth ID token so backend verifies the caller securely
    let idToken = '';
    try {
      idToken = await user.getIdToken();
    } catch {
      if (isStale()) return;
      setErrorMessage('Could not verify your login session. Please refresh and sign in again.');
      setStatus('error');
      teardownSession();
      return;
    }

    if (isStale()) return;

    // 3. Request microphone permission & prepare 16kHz PCM streamer before minting single-use token
    const micStreamer = new MicPcmStreamer(inputCtx);
    micStreamerRef.current = micStreamer;

    try {
      await micStreamer.start(
        (base64Audio) => {
          liveClientRef.current?.sendAudioPcm16k(base64Audio);
        },
        (level) => {
          micLevelRef.current = level;
        }
      );
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume().catch(() => {});
      }
      if (outputCtx.state === 'suspended') {
        setSpeakerBlocked(true);
      } else {
        setSpeakerBlocked(false);
      }
    } catch (micErr) {
      if (isStale()) return;
      const rawName = micErr instanceof DOMException ? micErr.name : '';
      let msg =
        micErr instanceof Error
          ? micErr.message
          : 'Microphone permission is required for Voice Call Mode.';
      if (rawName === 'NotAllowedError' || rawName === 'PermissionDeniedError') {
        msg =
          'Microphone permission was denied. Please allow microphone access in your browser site settings and tap Retry Call.';
      } else if (rawName === 'NotFoundError' || rawName === 'DevicesNotFoundError') {
        msg = 'No microphone was detected on this device.';
      } else if (rawName === 'NotReadableError') {
        msg =
          'Your microphone is currently in use by another app or tab. Close the other app and tap Retry Call.';
      }
      setErrorMessage(msg);
      setStatus('error');
      teardownSession();
      return;
    }

    if (isStale()) return;

    // 4. Request short-lived constrained ephemeral token from backend (/api/live-token)
    let tokenPayload;
    try {
      tokenPayload = await fetchLiveEphemeralToken(idToken, contextRef.current);
    } catch (tokenErr) {
      if (isStale()) return;
      const msg =
        tokenErr instanceof Error
          ? tokenErr.message
          : 'Unable to obtain a secure Gemini Live voice token from the server.';
      if (import.meta.env.DEV) {
        console.error('[RosoFood Live] Failed to fetch ephemeral token:', msg, tokenErr);
      }
      setErrorMessage(msg);
      setStatus('error');
      teardownSession();
      return;
    }

    if (isStale()) return;

    // 5. Connect browser directly to Gemini Live BidiGenerateContentConstrained WebSocket
    const liveClient = new GeminiLiveBrowserClient(contextRef.current, {
      onConnected: () => {
        if (isStale()) return;
        setStatus(isMutedRef.current ? 'muted' : 'listening');
      },
      onAudioOutput: (base64Pcm24k) => {
        if (isStale()) return;
        setIsInterruptedBadge(false);
        if (outputCtxRef.current?.state === 'suspended') {
          void outputCtxRef.current
            .resume()
            .then(() => {
              if (outputCtxRef.current?.state === 'running') {
                setSpeakerBlocked(false);
              }
            })
            .catch(() => setSpeakerBlocked(true));
        }
        player.enqueueBase64Pcm24k(base64Pcm24k);
      },
      onInputTranscript: (text) => {
        if (isStale()) return;
        setTranscripts((prev) => appendTranscriptChunk(prev, 'user', text));
      },
      onOutputTranscript: (text) => {
        if (isStale()) return;
        setTranscripts((prev) => appendTranscriptChunk(prev, 'assistant', text));
      },
      onInterrupted: () => {
        if (isStale()) return;
        player.stopAll();
        setIsInterruptedBadge(true);
        setTranscripts((prev) => finalizeOpenTranscripts(prev));
        window.setTimeout(() => setIsInterruptedBadge(false), 1600);
      },
      onTurnComplete: () => {
        if (isStale()) return;
        setTranscripts((prev) => finalizeOpenTranscripts(prev));
      },
      onToolProfileUpdate: (partialProfile) => {
        if (isStale()) return;
        const mergedProfile: UserDietProfile = {
          ...(contextRef.current.dietProfile || {}),
          ...partialProfile,
        };
        void onSaveDietProfile(mergedProfile)
          .then(() => {
            setTranscripts((prev) => [
              ...finalizeOpenTranscripts(prev),
              {
                id: `notice-${Date.now()}`,
                role: 'notice',
                text: 'Saved updated details to your RosoFood profile.',
                finalized: true,
              },
            ]);
          })
          .catch(() => {
            // Unverified email toast handled by App
          });
      },
      onToolGoalsUpdate: (nextGoals) => {
        if (isStale()) return;
        void onUpdateGoals(nextGoals).then(() => {
          setTranscripts((prev) => [
            ...finalizeOpenTranscripts(prev),
            {
              id: `notice-${Date.now()}`,
              role: 'notice',
              text: `Updated daily target to ${nextGoals.caloriesKcal} kcal.`,
              finalized: true,
            },
          ]);
        });
      },
      onError: (message) => {
        if (isStale()) return;
        setErrorMessage(message);
        setStatus('error');
        teardownSession();
      },
      onClosed: () => {
        if (!isStale() && statusRef.current !== 'error') {
          setStatus('ended');
          teardownSession();
        }
      },
    });

    liveClientRef.current = liveClient;
    liveClient.connect(tokenPayload);
  }, [onSaveDietProfile, onUpdateGoals, teardownSession, user]);

  // Start call automatically when modal opens; clean up on close/unmount
  useEffect(() => {
    if (isOpen) {
      void startCall();
    } else {
      teardownSession();
      setStatus('idle');
    }
    return () => {
      teardownSession();
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleEndCall() {
    teardownSession();
    setStatus('ended');
  }

  function handleCloseModal() {
    teardownSession();
    onClose();
  }

  function handleToggleMute() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    micStreamerRef.current?.setMuted(nextMuted);
    if (!isAssistantSpeaking) {
      setStatus(nextMuted ? 'muted' : 'listening');
    }
  }

  async function handleEnableSpeaker() {
    if (outputCtxRef.current && outputCtxRef.current.state === 'suspended') {
      await outputCtxRef.current.resume().catch(() => {});
    }
    if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
      await inputCtxRef.current.resume().catch(() => {});
    }
    setSpeakerBlocked(false);
  }

  function handleChangeLanguage(nextLang: AssistantLanguagePreference) {
    setLanguagePref(nextLang);
    if (liveClientRef.current?.isReady()) {
      const updatedContext = { ...contextRef.current, preferredLanguage: nextLang };
      liveClientRef.current.updateContext(updatedContext);
    }
  }

  function handleSendPrompt(promptText: string) {
    const clean = promptText.trim();
    if (!clean) return;
    if (!liveClientRef.current?.isReady()) {
      return;
    }
    playerRef.current?.stopAll();
    setTranscripts((prev) => [
      ...finalizeOpenTranscripts(prev),
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: clean,
        finalized: true,
      },
    ]);
    liveClientRef.current.sendText(clean);
  }

  async function handleSaveInlineProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileNotice(null);

    const nextProfile: UserDietProfile = {};
    if (ageDraft.trim()) {
      const age = Number(ageDraft);
      if (!Number.isFinite(age) || age < 13 || age > 100) {
        setProfileNotice('Age must be between 13 and 100.');
        return;
      }
      nextProfile.age = Math.round(age);
    }
    if (heightDraft.trim()) {
      const heightCm = Number(heightDraft);
      if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
        setProfileNotice('Height must be between 100 and 250 cm.');
        return;
      }
      nextProfile.heightCm = Math.round(heightCm * 10) / 10;
    }
    if (weightDraft.trim()) {
      const weightKg = Number(weightDraft);
      if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 300) {
        setProfileNotice('Weight must be between 25 and 300 kg.');
        return;
      }
      nextProfile.weightKg = Math.round(weightKg * 10) / 10;
    }
    if (activityDraft) nextProfile.activityLevel = activityDraft;
    if (goalDraft) nextProfile.fitnessGoal = goalDraft;
    if (dietPrefDraft) nextProfile.dietaryPreference = dietPrefDraft;

    setIsSavingProfile(true);
    try {
      await onSaveDietProfile(nextProfile);
      setProfileNotice('Saved! Roso now uses your updated details.');
      onShowToast?.('Diet profile updated');
      if (liveClientRef.current?.isReady()) {
        const freshContext = buildDietAssistantContext({
          displayName,
          dailyGoals,
          dietProfile: nextProfile,
          trackedMeals,
          selectedDateKey,
          preferredLanguage: languagePref,
        });
        liveClientRef.current.updateContext(freshContext);
      }
    } catch (err) {
      setProfileNotice(
        err instanceof Error ? err.message : 'Unable to save profile right now.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  if (!isOpen) return null;

  const isCallActive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'speaking' ||
    status === 'muted';

  const statusText =
    status === 'connecting'
      ? 'Connecting to Roso...'
      : isInterruptedBadge
        ? 'Listening (interrupted)'
        : status === 'speaking'
          ? 'Roso is speaking'
          : status === 'muted'
            ? 'Microphone muted'
            : status === 'listening'
              ? 'Listening — speak naturally'
              : status === 'ended'
                ? 'Call ended'
                : status === 'error'
                  ? 'Connection interrupted'
                  : 'Ready';

  const missingCount = assistantContext.missingProfileFields.length;

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-gradient-to-b from-[#241118] via-[#2F121D] to-[#17090E] text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-assistant-title"
    >
      {/* Top Call Bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#BE123C] text-white">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="voice-assistant-title"
              className="truncate font-display text-sm font-bold text-white sm:text-base"
            >
              RosoFood AI Diet Assistant
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-rose-200/80">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === 'speaking'
                    ? 'bg-emerald-400 animate-pulse'
                    : status === 'listening'
                      ? 'bg-rose-400 animate-pulse'
                      : status === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : status === 'muted'
                          ? 'bg-amber-400'
                          : 'bg-white/40'
                }`}
              />
              <span className="truncate">{statusText}</span>
              {(isCallActive || callSeconds > 0) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{formatDuration(callSeconds)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="hidden sm:block">
            <span className="sr-only">Preferred voice language</span>
            <select
              value={languagePref}
              onChange={(e) =>
                handleChangeLanguage(e.target.value as AssistantLanguagePreference)
              }
              className="min-h-[36px] rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white focus:border-rose-400 focus:outline-none"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#241118] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Close voice assistant"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile Language Selector Strip */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/15 px-4 py-2 sm:hidden">
        <span className="text-[11px] font-medium text-rose-200/80">Language</span>
        <select
          value={languagePref}
          onChange={(e) => handleChangeLanguage(e.target.value as AssistantLanguagePreference)}
          aria-label="Preferred voice language"
          className="min-h-[32px] rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs font-medium text-white focus:outline-none"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#241118] text-white">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Call Stage */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Scrollable Stage Content */}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
          {/* Avatar + Real-Time Waveform */}
          <div className="flex shrink-0 flex-col items-center pt-2 pb-4 text-center">
            <div className="relative flex items-center justify-center">
              {/* Animated speaking / listening aura */}
              <div
                className={`absolute h-32 w-32 rounded-full transition-transform duration-200 sm:h-36 sm:w-36 ${
                  status === 'speaking'
                    ? 'scale-110 bg-rose-500/30 animate-pulse'
                    : status === 'listening'
                      ? 'scale-105 bg-rose-400/20'
                      : 'scale-100 bg-white/5'
                }`}
              />
              <div
                className={`relative h-24 w-24 overflow-hidden rounded-full border-2 shadow-xl sm:h-28 sm:w-28 ${
                  status === 'speaking'
                    ? 'border-rose-400'
                    : status === 'listening'
                      ? 'border-rose-300/70'
                      : 'border-white/25'
                }`}
              >
                {!avatarFailed ? (
                  <img
                    src={ASSISTANT_AVATAR_PATH}
                    alt="Roso — RosoFood AI Personal Diet Assistant"
                    onError={() => setAvatarFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#BE123C] text-white">
                    <Sparkles className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>

            <p className="mt-3 font-display text-lg font-bold tracking-tight text-white">
              Roso · Personal Nutrition Coach
            </p>
            <p className="mt-0.5 text-xs text-rose-200/80">
              Supports Hindi, Hinglish &amp; English · Today: {assistantContext.todaySummary.totals.caloriesKcal} /{' '}
              {dailyGoals.caloriesKcal} kcal ({assistantContext.todaySummary.mealCount} meals)
            </p>

            {/* Live Multi-Bar Voice Waveform */}
            <div
              aria-hidden="true"
              className="mt-3 flex h-10 items-center justify-center gap-1.5"
            >
              {waveBars.map((bar, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isAssistantSpeaking
                      ? 'bg-rose-400'
                      : status === 'listening'
                        ? 'bg-rose-200'
                        : 'bg-white/30'
                  }`}
                  style={{ height: `${Math.round(bar * 38)}px` }}
                />
              ))}
            </div>

            {speakerBlocked && isCallActive && (
              <button
                type="button"
                onClick={() => void handleEnableSpeaker()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-[#241118] shadow hover:bg-amber-400 cursor-pointer"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Tap to Enable Speaker Audio
              </button>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-950/60 p-3.5 text-xs text-red-100"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold text-white">Unable to continue voice call</p>
                <p className="mt-1 leading-relaxed text-red-100/90">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => void startCall()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#241118] hover:bg-rose-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry Call
              </button>
            </div>
          )}

          {/* Missing profile hint */}
          {missingCount > 0 && !showProfileDrawer && (
            <button
              type="button"
              onClick={() => setShowProfileDrawer(true)}
              className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-rose-300/25 bg-white/10 px-3.5 py-2.5 text-left text-xs text-rose-100 transition-colors hover:bg-white/15 cursor-pointer"
            >
              <span>
                Add your age, height, weight, and fitness goal ({missingCount} missing) for more
                tailored guidance — or just tell Roso by voice.
              </span>
              <span className="shrink-0 font-semibold text-rose-300 underline underline-offset-2">
                Edit Profile
              </span>
            </button>
          )}

          {/* Live Conversation Transcript */}
          <div className="flex-1 space-y-2.5 rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
            {transcripts.length === 0 ? (
              <div className="flex h-full min-h-[120px] flex-col items-center justify-center text-center text-xs text-rose-200/70">
                <p>
                  {status === 'connecting'
                    ? 'Establishing real-time Gemini Live voice link...'
                    : status === 'ended'
                      ? 'Call ended. Tap Call Again below to start a new voice session.'
                      : 'Speak naturally in English, Hindi, or Hinglish — live captions appear here.'}
                </p>
              </div>
            ) : (
              transcripts.map((msg) =>
                msg.role === 'notice' ? (
                  <div
                    key={msg.id}
                    className="flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-emerald-300"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{msg.text}</span>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <span className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-rose-200/60">
                      {msg.role === 'user' ? 'You' : 'Roso AI'}
                    </span>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed sm:text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#BE123C] text-white'
                          : 'border border-white/10 bg-white/10 text-rose-50'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                )
              )
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Quick Prompt Chips & Optional Text Message during Call */}
          {isCallActive && (
            <div className="mt-3 shrink-0 space-y-2.5">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {QUICK_PROMPTS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    disabled={status === 'connecting'}
                    onClick={() => handleSendPrompt(chip.text)}
                    className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-rose-100 transition-colors hover:bg-white/20 disabled:opacity-40 cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (textInput.trim()) {
                    handleSendPrompt(textInput);
                    setTextInput('');
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Or type a question in English, Hindi, or Hinglish..."
                  maxLength={300}
                  className="min-h-[40px] flex-1 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs text-white placeholder:text-rose-200/50 focus:border-rose-400 focus:outline-none sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || status === 'connecting'}
                  aria-label="Send message to voice assistant"
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-white/15 px-3 text-white transition-colors hover:bg-white/25 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Slide-Over Personalization & Actual Data Drawer */}
        {showProfileDrawer && (
          <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/65 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4">
            <div className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#EEDCE0] bg-white text-[#241118] shadow-2xl sm:rounded-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-[#EEDCE0] px-5 py-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                  <h3 className="font-display text-sm font-bold text-[#241118]">
                    Your Profile &amp; Real Nutrition Data
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileDrawer(false)}
                  aria-label="Close profile drawer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#644A52] hover:bg-[#FDF3F5] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto p-5">
                {/* Real Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3">
                    <p className="text-[11px] font-medium text-[#7E6069]">
                      Today Logged ({assistantContext.todaySummary.mealCount} meals)
                    </p>
                    <p className="mt-1 font-mono text-base font-bold text-[#241118] tabular-nums">
                      {assistantContext.todaySummary.totals.caloriesKcal} / {dailyGoals.caloriesKcal}{' '}
                      kcal
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#644A52] tabular-nums">
                      P {assistantContext.todaySummary.totals.proteinGrams}g · C{' '}
                      {assistantContext.todaySummary.totals.carbsGrams}g · F{' '}
                      {assistantContext.todaySummary.totals.fatGrams}g
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-3">
                    <p className="text-[11px] font-medium text-[#7E6069]">
                      7-Day History ({assistantContext.weeklySummary.daysLoggedCount}/7 days)
                    </p>
                    <p className="mt-1 font-mono text-base font-bold text-[#241118] tabular-nums">
                      {assistantContext.weeklySummary.averageCaloriesWhenLogged} kcal/day
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#644A52] tabular-nums">
                      Avg Protein {assistantContext.weeklySummary.averageProteinWhenLogged}g ·{' '}
                      {assistantContext.weeklySummary.totalMealsLogged} meals
                    </p>
                  </div>
                </div>

                {/* Edit/Correct Profile Form */}
                <form onSubmit={handleSaveInlineProfile} className="space-y-3">
                  <p className="text-xs font-semibold text-[#241118]">
                    Personal Details (edit or correct anytime)
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] font-medium text-[#644A52]">Age (yrs)</span>
                      <input
                        type="number"
                        min={13}
                        max={100}
                        value={ageDraft}
                        onChange={(e) => setAgeDraft(e.target.value)}
                        placeholder="26"
                        className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] px-2.5 py-1.5 font-mono text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-[#644A52]">Height (cm)</span>
                      <input
                        type="number"
                        min={100}
                        max={250}
                        step="0.5"
                        value={heightDraft}
                        onChange={(e) => setHeightDraft(e.target.value)}
                        placeholder="172"
                        className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] px-2.5 py-1.5 font-mono text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-[#644A52]">Weight (kg)</span>
                      <input
                        type="number"
                        min={25}
                        max={300}
                        step="0.5"
                        value={weightDraft}
                        onChange={(e) => setWeightDraft(e.target.value)}
                        placeholder="68"
                        className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] px-2.5 py-1.5 font-mono text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] font-medium text-[#644A52]">
                        Activity Level
                      </span>
                      <select
                        value={activityDraft}
                        onChange={(e) =>
                          setActivityDraft(e.target.value as DietActivityLevel | '')
                        }
                        className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                      >
                        <option value="">Not specified</option>
                        <option value="sedentary">Sedentary (Desk / Minimal)</option>
                        <option value="light">Lightly Active (1-3x/wk)</option>
                        <option value="moderate">Moderately Active (3-5x/wk)</option>
                        <option value="active">Very Active (6-7x/wk)</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-[#644A52]">Fitness Goal</span>
                      <select
                        value={goalDraft}
                        onChange={(e) => setGoalDraft(e.target.value as DietFitnessGoal | '')}
                        className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                      >
                        <option value="">Not specified</option>
                        <option value="weight_loss">Weight Loss</option>
                        <option value="weight_gain">Weight Gain</option>
                        <option value="muscle_building">Muscle Building</option>
                        <option value="maintenance">Balanced Maintenance</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-medium text-[#644A52]">
                      Dietary Preference
                    </span>
                    <select
                      value={dietPrefDraft}
                      onChange={(e) =>
                        setDietPrefDraft(e.target.value as DietaryPreference | '')
                      }
                      className="mt-1 min-h-[38px] w-full rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-xs text-[#241118] focus:border-[#BE123C] focus:outline-none"
                    >
                      <option value="">Not specified</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="non-vegetarian">Non-Vegetarian</option>
                      <option value="eggetarian">Eggetarian</option>
                      <option value="vegan">Vegan</option>
                    </select>
                  </label>

                  {profileNotice && (
                    <p className="rounded-lg bg-[#FFF8F9] px-3 py-2 text-xs font-medium text-[#BE123C]">
                      {profileNotice}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowProfileDrawer(false)}
                      className="min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-medium text-[#644A52] hover:bg-[#FDF3F5] cursor-pointer"
                    >
                      Done
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="min-h-[38px] rounded-lg bg-[#BE123C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#9F1239] disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingProfile ? 'Saving...' : 'Save & Sync Assistant'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safety Notice + Phone-Style Bottom Controls */}
      <footer className="shrink-0 border-t border-white/10 bg-[#17090E]/95 px-4 pt-2.5 pb-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-rose-200/70">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-300/80" aria-hidden="true" />
            <span>
              General nutrition guidance only, not medical advice. AI calorie &amp; macro
              estimates are approximate.
            </span>
          </p>

          <div className="flex w-full items-center justify-center gap-5 sm:gap-7">
            {/* Profile / Data Sheet button */}
            <button
              type="button"
              onClick={() => setShowProfileDrawer(true)}
              className="relative flex flex-col items-center gap-1 text-xs font-medium text-rose-100 hover:text-white cursor-pointer"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 transition-colors hover:bg-white/20">
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              {missingCount > 0 && (
                <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#17090E]" />
              )}
              <span className="text-[11px]">My Data</span>
            </button>

            {isCallActive ? (
              <>
                {/* Mute / Unmute Mic */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  disabled={status === 'connecting'}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className="flex flex-col items-center gap-1 text-xs font-medium text-rose-100 hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  <span
                    className={`flex h-13 w-13 items-center justify-center rounded-full border transition-colors ${
                      isMuted
                        ? 'border-amber-400 bg-amber-500 text-[#241118]'
                        : 'border-white/20 bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Mic className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="text-[11px]">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                {/* End Voice Call */}
                <button
                  type="button"
                  onClick={handleEndCall}
                  aria-label="End conversation"
                  className="flex flex-col items-center gap-1 text-xs font-medium text-rose-100 hover:text-white cursor-pointer"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/40 transition-colors hover:bg-red-700">
                    <PhoneOff className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-[11px]">End Call</span>
                </button>
              </>
            ) : (
              /* Call Again */
              <button
                type="button"
                onClick={() => void startCall()}
                aria-label="Start voice call"
                className="flex flex-col items-center gap-1 text-xs font-medium text-rose-100 hover:text-white cursor-pointer"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 transition-colors hover:bg-emerald-500">
                  <Phone className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-[11px]">Call Again</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
