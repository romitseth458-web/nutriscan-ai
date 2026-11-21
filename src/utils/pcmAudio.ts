// Real-time 16kHz PCM microphone capture & 24kHz PCM playback helpers for Gemini Live API

const TARGET_INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function downsampleFloat32(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i += 1) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(input.length - 1, lower + 1);
    const frac = srcIndex - lower;
    result[i] = input[lower] * (1 - frac) + input[upper] * frac;
  }
  return result;
}

function float32ToInt16Base64(samples: Float32Array): string {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(i * 2, Math.round(int16), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToFloat32Pcm16(base64: string): Float32Array {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    sumSquares += v * v;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(1, rms * 3.2);
}

export function createAudioContextSafe(preferredSampleRate: number): AudioContext {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  try {
    return new AudioCtx({ sampleRate: preferredSampleRate });
  } catch {
    return new AudioCtx();
  }
}

export class MicPcmStreamer {
  private audioCtx: AudioContext;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private muted = false;
  private stopped = false;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }

  async start(
    onAudioChunk: (base64Pcm16k: string) => void,
    onMicLevel?: (level: number) => void
  ): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Microphone capture is not supported in this browser. Please open RosoFood AI in a modern mobile or desktop browser.'
      );
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (this.stopped) {
      this.stopTracks();
      return;
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.processorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
    this.silentGainNode = this.audioCtx.createGain();
    this.silentGainNode.gain.value = 0;

    this.processorNode.onaudioprocess = (event) => {
      if (this.stopped) return;
      const rawChannel = event.inputBuffer.getChannelData(0);

      if (this.muted) {
        onMicLevel?.(0);
        return;
      }

      onMicLevel?.(computeRms(rawChannel));
      const resampled = downsampleFloat32(
        rawChannel,
        this.audioCtx.sampleRate,
        TARGET_INPUT_SAMPLE_RATE
      );
      const base64 = float32ToInt16Base64(resampled);
      onAudioChunk(base64);
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.silentGainNode);
    this.silentGainNode.connect(this.audioCtx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.stream) {
      for (const track of this.stream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  private stopTracks(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.silentGainNode) {
      this.silentGainNode.disconnect();
      this.silentGainNode = null;
    }
    this.stopTracks();
  }
}

export class Pcm24kAudioPlayer {
  private audioCtx: AudioContext;
  private analyser: AnalyserNode;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private timeDomainData: Uint8Array<ArrayBuffer>;
  private onSpeakingChange?: (speaking: boolean) => void;

  constructor(audioCtx: AudioContext, onSpeakingChange?: (speaking: boolean) => void) {
    this.audioCtx = audioCtx;
    this.onSpeakingChange = onSpeakingChange;
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.audioCtx.destination);
    this.timeDomainData = new Uint8Array(
      new ArrayBuffer(this.analyser.frequencyBinCount)
    );
  }

  async ensureResumed(): Promise<void> {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  enqueueBase64Pcm24k(base64Audio: string): void {
    const floatSamples = base64ToFloat32Pcm16(base64Audio);
    if (floatSamples.length === 0) return;

    const buffer = this.audioCtx.createBuffer(1, floatSamples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(floatSamples);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);

    const now = this.audioCtx.currentTime;
    const startAt = Math.max(now + 0.02, this.nextStartTime);
    this.nextStartTime = startAt + buffer.duration;

    this.activeSources.add(source);
    if (this.activeSources.size === 1) {
      this.onSpeakingChange?.(true);
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.nextStartTime = 0;
        this.onSpeakingChange?.(false);
      }
    };

    source.start(startAt);
  }

  stopAll(): void {
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.onSpeakingChange?.(false);
  }

  getOutputLevel(): number {
    if (this.activeSources.size === 0) return 0;
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainData.length; i += 1) {
      const normalized = (this.timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / this.timeDomainData.length);
    return Math.min(1, rms * 3.5);
  }

  isPlaying(): boolean {
    return this.activeSources.size > 0;
  }
}
