import { Calculator, Camera, CheckCircle2, PieChart } from 'lucide-react';

interface HowItWorksSectionProps {
  onOpenCalculator: () => void;
}

const STEPS = [
  {
    number: '01.',
    title: 'Snap or Upload Any Plate',
    description:
      'Use your phone camera or upload any JPG/PNG meal photo. Home-cooked thalis, bowls, salads, breakfasts, and restaurant plates all work.',
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
      'Fine-tune the serving multiplier, review healthier vegetarian or non-vegetarian swaps, and log meals into your browser-saved Daily Tracker.',
    icon: CheckCircle2,
  },
];

const SUPPORTED_MEALS = [
  'Indian Thalis, Dal, Roti & Sabzi',
  'Rice Bowls, Stir-Fries & Curries',
  'Eggs, Toast & Breakfast Plates',
  'Salads, Wraps & Sandwiches',
  'Smoothies, Snacks & Desserts',
  'Grilled Meats, Fish & Paneer',
];

export function HowItWorksSection({ onOpenCalculator }: HowItWorksSectionProps) {
  return (
    <section id="how-it-works" className="border-b border-[#E2E8E4] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#15803D]">Built for Everyday Eating</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#0F1F16]">
              How NutriScan AI Works
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475E50]">
              No barcode scanning or manual ingredient typing required. Understand what is on your
              plate in three straightforward steps.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCalculator}
            className="inline-flex min-h-[42px] items-center gap-2 self-start rounded-xl border border-[#D4DFD7] bg-[#F8FAF8] px-4 py-2 text-xs font-semibold text-[#0F1F16] transition-colors hover:bg-[#EEF6F0] whitespace-nowrap shrink-0 cursor-pointer sm:self-auto"
          >
            <Calculator className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
            Calculate My Calorie Goal
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="rounded-2xl border border-[#E2E8E4] bg-[#F8FAF8] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-[#15803D]">
                    {step.number}
                  </span>
                  <Icon className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-[#0F1F16]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#475E50]">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Supported cuisines & privacy strip */}
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-[#E2E8E4] bg-white px-6 py-5 lg:flex-row lg:items-center">
          <div>
            <p className="font-display text-sm font-semibold text-[#0F1F16]">
              Recognizes Indian & Global Meals
            </p>
            <p className="mt-0.5 text-xs text-[#5B7063]">
              If a dish looks visually ambiguous (such as thick curries or sauces), NutriScan asks a
              quick clarifying question before finalizing numbers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475E50]">
            {SUPPORTED_MEALS.map((meal, idx) => (
              <span key={meal} className="inline-flex items-center gap-3">
                <span>{meal}</span>
                {idx < SUPPORTED_MEALS.length - 1 && (
                  <span className="text-[#B6CBB9]" aria-hidden="true">
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
