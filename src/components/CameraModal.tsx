import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertCircle } from 'lucide-react';
import { prepareImageFromCanvas, type PreparedFoodImage } from '../utils/imageUtils';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (image: PreparedFoodImage) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    async function startCamera() {
      setIsStarting(true);
      setError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Live camera preview is not supported in this browser. Use the Mobile Camera or Upload button instead.'
        );
        setIsStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error && err.name === 'NotAllowedError'
              ? 'Camera access was denied. Please grant camera permission or upload an image file.'
              : 'No accessible camera was found on this device. You can upload a JPG or PNG photo instead.';
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setIsStarting(false);
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  function handleTakeSnapshot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const prepared = prepareImageFromCanvas(canvas, `meal-capture-${Date.now()}.jpg`);
      onCapture(prepared);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to prepare captured photo. Please retry.'
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#241118]/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EEDCE0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
            <h2 id="camera-modal-title" className="font-display text-base font-semibold text-[#241118]">
              Capture Meal Photo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#644A52] transition-colors hover:bg-[#FDF3F5] hover:text-[#241118] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-red-700" aria-hidden="true" />
              <p className="max-w-sm text-sm font-medium text-red-900">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 min-h-[40px] rounded-lg bg-[#241118] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A1E28] cursor-pointer"
              >
                Return to Upload
              </button>
            </div>
          ) : (
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-[#241118]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#241118]/60 text-sm font-medium text-white">
                  Starting camera...
                </div>
              )}
            </div>
          )}
        </div>

        {!error && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEDCE0] bg-[#FFF8F9] px-5 py-4">
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#E5CFD4] bg-white px-4 py-2 text-sm font-medium text-[#241118] transition-colors hover:bg-[#FDF3F5] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 text-[#644A52]" aria-hidden="true" />
              Switch Camera
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[#644A52] hover:bg-[#F9EBEE] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isStarting}
                onClick={handleTakeSnapshot}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#BE123C] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9F1239] disabled:opacity-50 cursor-pointer"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Capture Photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
