import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Are my food photos or meal logs stored on a server?',
    a: 'No. Uploaded images are sent securely to the server-side Gemini Vision API strictly for analysis and discarded immediately afterward. Your Daily Food Diary history and targets are saved only in your own browser via LocalStorage.',
  },
  {
    q: 'How accurate are visual calorie and gram estimates?',
    a: 'All visual calorie and macro values are practical estimates based on visible ingredients and typical portion densities. Hidden cooking oils, butter, dressings, or exact recipe weights can change totals, so you can use the portion multiplier (0.5x to 2x) or clarification box to refine results.',
  },
  {
    q: 'Does RosoFood AI work for Indian home-cooked meals and mixed plates?',
    a: 'Yes. It identifies multi-item plates including South Indian tiffins (idli, dosa, vada, pongal, appam, sambar), North Indian meals (dal, sabzi, paneer curries, roti/chapati, rice, raita), salads, and international bowls, breaking down each visible item separately.',
  },
  {
    q: 'What happens if the AI cannot recognize a dish clearly?',
    a: 'Instead of guessing blindly, RosoFood AI flags the result as needing clarification and asks a specific follow-up question where you can type a short note (for example, "chicken biryani with raita, medium bowl") and re-analyze.',
  },
  {
    q: 'Can anyone use this on mobile without installing an app?',
    a: 'Yes. Open RosoFood AI in any mobile browser, tap Take Photo to use your phone camera directly, or tap Install App to add RosoFood to your home screen for quick daily meal logging.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-[#EEDCE0] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-medium text-[#BE123C]">Questions &amp; Privacy</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#241118]">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#644A52]">
              Everything you need to know about visual portion estimation, privacy, and daily
              tracking.
            </p>
          </div>

          <div className="divide-y divide-[#EEDCE0] rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] lg:col-span-8">
            {FAQS.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-white/70 cursor-pointer"
                  >
                    <span className="font-display text-sm font-semibold text-[#241118]">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#644A52] transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 text-sm leading-relaxed text-[#644A52]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
