import { Calculator, Camera, CheckCircle2, PieChart } from 'lucide-react';

interface HowItWorksSectionProps {
  onOpenCalculator: () => void;
}

const STEPS = [
  {
    number: '01.',
    title: 'Snap or Upload Any Plate',
    description:
      'Use your phone camera or upload any JPG/PNG meal photo. Home-cooked dishes made with love, thalis, bowls, and restaurant plates all work.',
    icon: Camera,
  },
  {
    number: '02.',
    title: 'Multi-Item Portion & Macro Scan',
    description:
      'Gemini Vision identifies distinct items on the plate, estimates gram weights from visual scale, and calculates calories, protein, carbs, fat, and fiber.',
    icon: PieChart,
  },
  {
    number: '03.',
    title: 'Personalize & Track Daily Totals',
    description:
      'Fine-tune the serving multiplier, review healthier vegetarian or non-vegetarian swaps, and log meals into your browser-saved Daily Food Diary.',
    icon: CheckCircle2,
  },
];

const SUPPORTED_MEALS = [
  'South Indian Tiffins & Meals',
  'North Indian Thalis, Dal & Roti',
  'Rice Bowls, Stir-Fries & Curries',
  'Eggs, Toast & Breakfast Plates',
  'Fresh Fruits, Salads & Smoothies',
  'Grilled Meats, Fish & Paneer',
];

export function HowItWorksSection({ onOpenCalculator }: HowItWorksSectionProps) {
  return (
    <section id="how-it-works" className="border-b border-[#EEDCE0] bg-white">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#BE123C]">Care In Every Bite</p>
            <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight text-[#241118] sm:text-xl">
              How RosoFood AI Works
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#644A52] sm:text-sm">
              No barcode scanning or manual ingredient typing required. Understand your plate in
              three quick steps.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCalculator}
            className="inline-flex min-h-[42px] items-center gap-2 self-start rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-4 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] whitespace-nowrap shrink-0 cursor-pointer sm:self-auto"
          >
            <Calculator className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
            Calculate My Calorie Goal
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-[#BE123C]">
                    {step.number}
                  </span>
                  <Icon className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                </div>
                <h3 className="mt-2 font-display text-sm font-semibold text-[#241118]">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Supported cuisines & privacy strip */}
        <div className="mt-3 flex flex-col justify-between gap-2 rounded-xl border border-[#EEDCE0] bg-white px-4 py-3 lg:flex-row lg:items-center">
          <div>
            <p className="font-display text-xs font-semibold text-[#241118] sm:text-sm">
              Recognizes Indian &amp; Global Meals
            </p>
            <p className="mt-0.5 text-[11px] text-[#7E6069]">
              If a dish looks ambiguous, RosoFood asks a quick clarifying question before finalizing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#644A52]">
            {SUPPORTED_MEALS.map((meal, idx) => (
              <span key={meal} className="inline-flex items-center gap-2.5">
                <span>{meal}</span>
                {idx < SUPPORTED_MEALS.length - 1 && (
                  <span className="text-[#D9A7B2]" aria-hidden="true">
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
