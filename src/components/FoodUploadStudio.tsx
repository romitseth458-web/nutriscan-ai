import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  AlertCircle,
  HelpCircle,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
} from 'lucide-react';
import type { FoodAnalysisResult } from '../types/nutrition';
import {
  formatBytes,
  prepareImageFromFile,
  prepareImageFromUrl,
  type PreparedFoodImage,
} from '../utils/imageUtils';
import { CameraModal } from './CameraModal';
import { PWAInstallButton } from './PWAInstallButton';

const HERO_IMAGE_PATH = '/src/assets/images/hero_mediterranean_bowl_1795193578143.jpg';

const SAMPLE_MEALS = [
  {
    id: 'salmon-bowl',
    label: 'Salmon Quinoa Bowl',
    fileName: 'salmon-quinoa-bowl.jpg',
    imageUrl: '/src/assets/images/hero_mediterranean_bowl_1795193578143.jpg',
  },
  {
    id: 'avocado-toast',
    label: 'Avocado Egg Toast',
    fileName: 'avocado-egg-toast.jpg',
    imageUrl: '/src/assets/images/sample_avocado_toast_1795193578808.jpg',
  },
  {
    id: 'chicken-bowl',
    label: 'Teriyaki Chicken Bowl',
    fileName: 'teriyaki-chicken-bowl.jpg',
    imageUrl: '/src/assets/images/sample_chicken_stirfry_1795193578746.jpg',
  },
  {
    id: 'paneer-thali',
    label: 'Palak Paneer Thali',
    fileName: 'palak-paneer-thali.jpg',
    imageUrl: '/src/assets/images/sample_paneer_thali_1795193577934.jpg',
  },
  {
    id: 'fruit-platter',
    label: 'Fresh Fruit Platter',
    fileName: 'fresh-fruit-platter.jpg',
    imageUrl: '/src/assets/images/sample_fruit_platter_1795194404141.jpg',
  },
];

interface FoodUploadStudioProps {
  selectedImage: PreparedFoodImage | null;
  onSelectImage: (image: PreparedFoodImage | null) => void;
  onAnalyze: (image: PreparedFoodImage, clarification?: string) => Promise<void>;
  isAnalyzing: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  analysisResult: FoodAnalysisResult | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onShowToast?: (message: string) => void;
}

export function FoodUploadStudio({
  selectedImage,
  onSelectImage,
  onAnalyze,
  isAnalyzing,
  errorMessage,
  onClearError,
  analysisResult,
  fileInputRef,
  onShowToast,
}: FoodUploadStudioProps) {
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [clarificationText, setClarificationText] = useState('');
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  const activeError = localError || errorMessage;

  const needsClarification =
    analysisResult &&
    (analysisResult.identificationStatus === 'needs_clarification' ||
      analysisResult.identificationStatus === 'not_food');

  async function processFile(file: File) {
    setLocalError(null);
    onClearError();
    setClarificationText('');
    try {
      const prepared = await prepareImageFromFile(file);
      onSelectImage(prepared);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  async function handleSelectSample(sample: (typeof SAMPLE_MEALS)[number]) {
    setLocalError(null);
    onClearError();
    setClarificationText('');
    setLoadingSampleId(sample.id);
    try {
      const prepared = await prepareImageFromUrl(sample.imageUrl, sample.fileName);
      onSelectImage(prepared);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to load sample meal.');
    } finally {
      setLoadingSampleId(null);
    }
  }

  function handleClearSelection() {
    onSelectImage(null);
    setLocalError(null);
    onClearError();
    setClarificationText('');
  }

  async function handleClarificationSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedImage || !clarificationText.trim()) return;
    await onAnalyze(selectedImage, clarificationText.trim());
  }

  return (
    <section id="analyzer" className="border-b border-[#E2E8E4] bg-white">
      {/* Hidden native inputs for file upload & mobile camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Upload JPG, JPEG, or PNG food image"
      />
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Capture food photo using device camera"
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left column: Hero Proposition + Upload Controls */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <p className="text-xs font-medium tracking-wide text-[#15803D]">
                Gemini Vision Nutrition Analysis
              </p>
              <h1
                className="mt-3 font-display font-bold tracking-tight text-[#0F1F16]"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3.35rem)',
                  lineHeight: 1.08,
                  textWrap: 'balance',
                }}
              >
                Estimate meal calories and macros from one photo.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#475E50]">
                Upload a photo of your plate or snap one with your camera. RosoFood AI detects
                visible ingredients, estimates portion weights in grams, breaks down macros, and
                suggests tailored healthier swaps.
              </p>

              {/* Primary upload & camera action controls */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="inline-flex min-h-[46px] items-center gap-2.5 rounded-xl bg-[#15803D] px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload Food Image
                </button>

                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={isAnalyzing}
                  className="hidden sm:inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#D4DFD7] bg-[#F8FAF8] px-5 py-3 text-sm font-semibold text-[#0F1F16] transition-colors duration-150 hover:bg-[#EEF4EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                  Use Camera
                </button>

                <button
                  type="button"
                  onClick={() => mobileCameraInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="inline-flex sm:hidden min-h-[46px] items-center gap-2 rounded-xl border border-[#D4DFD7] bg-[#F8FAF8] px-5 py-3 text-sm font-semibold text-[#0F1F16] transition-colors duration-150 hover:bg-[#EEF4EF] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                  Take Photo
                </button>

                <PWAInstallButton variant="hero" onInstalledToast={onShowToast} />
              </div>

              <p className="mt-3 text-xs text-[#5B7063]">
                Accepts JPG, JPEG, and PNG up to 8 MB · Values saved locally in your browser
              </p>
            </div>

            {/* Quick sample meals row */}
            <div className="mt-8 border-t border-[#E2E8E4] pt-6">
              <p className="text-xs font-medium text-[#475E50]">
                Try a sample meal or fruit platter to test live Gemini Vision analysis
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {SAMPLE_MEALS.map((sample) => {
                  const isLoadingThis = loadingSampleId === sample.id;
                  const isActive = selectedImage?.fileName === sample.fileName;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      disabled={isAnalyzing || Boolean(loadingSampleId)}
                      onClick={() => void handleSelectSample(sample)}
                      className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'border-[#15803D] bg-[#F2F8F4]'
                          : 'border-[#E2E8E4] bg-[#F8FAF8] hover:border-[#B6CBB9] hover:bg-white'
                      }`}
                    >
                      <div className="aspect-4/3 w-full overflow-hidden bg-[#EBF1EC]">
                        <img
                          src={sample.imageUrl}
                          alt={sample.label}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      </div>
                      <span className="truncate px-2.5 py-2 text-xs font-medium text-[#0F1F16]">
                        {isLoadingThis ? 'Loading...' : sample.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: Interactive Dropzone / Image Preview / Analysis Trigger */}
          <div className="flex flex-col lg:col-span-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-1 flex-col overflow-hidden rounded-2xl border transition-colors duration-150 ${
                isDragging
                  ? 'border-[#15803D] bg-[#EEF6F0]'
                  : 'border-[#DCE5DE] bg-[#F8FAF8]'
              }`}
            >
              {!selectedImage ? (
                <div className="relative flex min-h-[340px] flex-1 flex-col justify-end lg:min-h-full">
                  {!heroImageFailed ? (
                    <img
                      src={HERO_IMAGE_PATH}
                      alt="Mediterranean grilled salmon and quinoa bowl"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImageFailed(true)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#EEF6F0] to-[#DCECE0]">
                      <ImageIcon className="h-16 w-16 text-[#15803D]/40" aria-hidden="true" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1911]/85 via-[#0B1911]/30 to-transparent" />

                  <div className="relative z-10 p-6 sm:p-7">
                    <div className="flex flex-col gap-4 rounded-xl border border-white/20 bg-[#0F1F16]/75 p-5 text-white backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-display text-base font-semibold">
                          Drop a meal photo here
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                          Or click Upload Food Image to inspect calories, protein, carbs, fat, and
                          fiber.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Browse File
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  {/* Image preview frame with loading scan animation */}
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-[#0F1F16]">
                    <img
                      src={selectedImage.previewDataUrl}
                      alt="Selected meal preview"
                      className="h-full w-full object-cover"
                    />

                    {isAnalyzing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F1F16]/60 backdrop-blur-[2px]">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-400/35 to-transparent animate-scan-beam" />
                        <div className="relative z-10 flex flex-col items-center rounded-xl border border-white/15 bg-[#0F1F16]/85 px-6 py-4 text-center text-white shadow-lg">
                          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-hidden="true" />
                          <p className="mt-2.5 font-display text-sm font-semibold">
                            Analyzing meal with Gemini Vision...
                          </p>
                          <p className="mt-1 text-xs text-white/75">
                            Identifying food items, portion weights, and macros
                          </p>
                        </div>
                      </div>
                    )}

                    {!isAnalyzing && (
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        aria-label="Remove selected image"
                        className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F1F16]/75 text-white transition-colors hover:bg-[#0F1F16] cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Preview metadata and Analyze Food action bar */}
                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0F1F16]">
                          {selectedImage.fileName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#475E50] tabular-nums">
                          <span>{selectedImage.mimeType === 'image/png' ? 'PNG' : 'JPEG'}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {selectedImage.width} × {selectedImage.height} px
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBytes(selectedImage.fileSizeBytes)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          disabled={isAnalyzing}
                          onClick={() => fileInputRef.current?.click()}
                          className="min-h-[40px] rounded-lg border border-[#D4DFD7] bg-white px-3.5 py-2 text-xs font-medium text-[#0F1F16] hover:bg-[#F2F6F3] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          disabled={isAnalyzing}
                          onClick={() => void onAnalyze(selectedImage)}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#15803D] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          {isAnalyzing ? 'Analyzing...' : 'Analyze Food'}
                        </button>
                      </div>
                    </div>

                    {/* Clarification prompt when food cannot be reliably identified */}
                    {needsClarification && !isAnalyzing && (
                      <form
                        onSubmit={handleClarificationSubmit}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <div className="flex items-start gap-2.5">
                          <HelpCircle
                            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-950">
                              {analysisResult.identificationStatus === 'not_food'
                                ? 'No food detected in this image'
                                : 'Clarification needed for accurate macros'}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-900">
                              {analysisResult.clarificationQuestion}
                            </p>
                          </div>
                        </div>

                        {analysisResult.identificationStatus === 'needs_clarification' && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              value={clarificationText}
                              onChange={(e) => setClarificationText(e.target.value)}
                              placeholder="e.g., Chicken tikka masala with 1 cup basmati rice"
                              className="min-h-[40px] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-[#0F1F16] placeholder:text-[#7A8C81] focus:border-[#15803D] focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={!clarificationText.trim() || isAnalyzing}
                              className="min-h-[40px] rounded-lg bg-[#0F1F16] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E3A2A] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Re-analyze with Details
                            </button>
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>

            {activeError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <span className="flex-1">{activeError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalError(null);
                    onClearError();
                  }}
                  aria-label="Dismiss error"
                  className="text-red-700 hover:text-red-900 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(prepared) => {
          setLocalError(null);
          onClearError();
          setClarificationText('');
          onSelectImage(prepared);
        }}
      />
    </section>
  );
}
