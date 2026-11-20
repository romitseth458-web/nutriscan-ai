import { useState } from 'react';
import { Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'hero' | 'drawer';
  onInstalledToast?: (message: string) => void;
}

export function PWAInstallButton({
  variant = 'hero',
  onInstalledToast,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, platform, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Hide install button once running in standalone installed mode
  if (isInstalled) {
    return null;
  }

  async function handleClick() {
    if (isInstallable) {
      const accepted = await install();
      if (accepted && onInstalledToast) {
        onInstalledToast('RosoFood AI installed on your device');
      }
      return;
    }
    setShowGuideModal(true);
  }

  const buttonClasses =
    variant === 'drawer'
      ? 'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#15803D]/30 bg-[#EEF6F0] px-4 py-2 text-sm font-semibold text-[#15803D] transition-colors hover:bg-[#E0F0E4] cursor-pointer'
      : 'inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#15803D]/30 bg-[#EEF6F0] px-5 py-3 text-sm font-semibold text-[#15803D] transition-colors duration-150 hover:bg-[#E1EFE5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer';

  return (
    <>
      <button type="button" onClick={() => void handleClick()} className={buttonClasses}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Install App
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1F16]/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8E4] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8E4] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt="RosoFood AI icon"
                  className="h-8 w-8 rounded-lg"
                />
                <h2
                  id="pwa-install-guide-title"
                  className="font-display text-base font-bold text-[#0F1F16]"
                >
                  Install RosoFood AI
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close installation guide"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475E50] hover:bg-[#F2F6F3] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-sm text-[#475E50]">
              <p className="text-xs leading-relaxed">
                Install RosoFood AI on your home screen for full-screen camera scanning and fast
                access to your Daily Food Tracker.
              </p>

              {platform === 'ios' ? (
                <div className="rounded-xl border border-[#E2E8E4] bg-[#F8FAF8] p-4">
                  <p className="font-display text-xs font-semibold text-[#0F1F16]">
                    iPhone &amp; iPad (Safari)
                  </p>
                  <ol className="mt-2.5 space-y-2 text-xs leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">1.</span>
                      <span>
                        Tap the <Share className="inline h-3.5 w-3.5 text-[#15803D]" />{' '}
                        <strong className="text-[#0F1F16]">Share</strong> button in Safari&apos;s
                        bottom toolbar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">2.</span>
                      <span>
                        Scroll down and select{' '}
                        <strong className="text-[#0F1F16]">Add to Home Screen</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">3.</span>
                      <span>
                        Tap <strong className="text-[#0F1F16]">Add</strong> in the top-right corner.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : platform === 'android' ? (
                <div className="rounded-xl border border-[#E2E8E4] bg-[#F8FAF8] p-4">
                  <p className="font-display text-xs font-semibold text-[#0F1F16]">
                    Android (Chrome / Edge)
                  </p>
                  <ol className="mt-2.5 space-y-2 text-xs leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">1.</span>
                      <span>
                        Tap the <MoreVertical className="inline h-3.5 w-3.5 text-[#15803D]" />{' '}
                        <strong className="text-[#0F1F16]">three-dot menu</strong> in the top-right
                        of Chrome.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">2.</span>
                      <span>
                        Tap <strong className="text-[#0F1F16]">Install app</strong> or{' '}
                        <strong className="text-[#0F1F16]">Add to Home screen</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">3.</span>
                      <span>
                        Confirm <strong className="text-[#0F1F16]">Install</strong> to launch
                        RosoFood like a native app.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E2E8E4] bg-[#F8FAF8] p-4">
                  <p className="flex items-center gap-2 font-display text-xs font-semibold text-[#0F1F16]">
                    <Smartphone className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                    Desktop &amp; Mobile Browsers
                  </p>
                  <ol className="mt-2.5 space-y-2 text-xs leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">1.</span>
                      <span>
                        <strong className="text-[#0F1F16]">Chrome / Edge (Desktop):</strong> Click
                        the install icon on the right side of the address bar or open Browser Menu →{' '}
                        <strong className="text-[#0F1F16]">Install RosoFood AI</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">2.</span>
                      <span>
                        <strong className="text-[#0F1F16]">Android Chrome:</strong> Tap{' '}
                        <MoreVertical className="inline h-3.5 w-3.5 text-[#15803D]" /> →{' '}
                        <strong className="text-[#0F1F16]">Install app</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-[#15803D]">3.</span>
                      <span>
                        <strong className="text-[#0F1F16]">iPhone Safari:</strong> Tap Share →{' '}
                        <strong className="text-[#0F1F16]">Add to Home Screen</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-[#E2E8E4] bg-[#F8FAF8] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] rounded-lg bg-[#15803D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#166534] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
