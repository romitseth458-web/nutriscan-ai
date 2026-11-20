import { useState } from 'react';
import { ArrowDownRight, Dumbbell, Leaf, Salad, UtensilsCrossed } from 'lucide-react';
import type { FoodAnalysisResult } from '../types/nutrition';

interface DietSuggestionsSectionProps {
  analysis: FoodAnalysisResult | null;
}

type DietFilter = 'all' | 'vegetarian' | 'non-vegetarian';

export function DietSuggestionsSection({ analysis }: DietSuggestionsSectionProps) {
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');

  if (!analysis || analysis.identificationStatus !== 'identified') {
    return (
      <section id="diet-guide" className="border-b border-[#EEDCE0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-xl font-bold text-[#241118]">
                AI Diet Recommendations
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm text-[#644A52]">
                Once a meal is analyzed, RosoFood AI generates calorie-saving swaps, high-protein
                enhancements, and vegetarian and non-vegetarian alternatives tailored to your dish.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-5">
              <Salad className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
              <h3 className="mt-3 font-display text-sm font-semibold text-[#241118]">
                Healthier Alternatives
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                Lower-calorie preparation swaps and whole-food ingredient upgrades without
                sacrificing flavor.
              </p>
            </div>
            <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-5">
              <Dumbbell className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
              <h3 className="mt-3 font-display text-sm font-semibold text-[#241118]">
                High-Protein Options
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                Targeted protein additions showing exact gram increases to improve satiety and
                muscle recovery.
              </p>
            </div>
            <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-5">
              <Leaf className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
              <h3 className="mt-3 font-display text-sm font-semibold text-[#241118]">
                Veg &amp; Non-Veg Plans
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                Balanced alternatives tailored for both vegetarian and non-vegetarian dietary
                preferences.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { dietSuggestions } = analysis;

  return (
    <section id="diet-guide" className="border-b border-[#EEDCE0] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#BE123C]">Tailored Nutrition Guidance</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#241118]">
              AI Diet Suggestions for {analysis.mealTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#644A52]">
              {dietSuggestions.summary}
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter dietary options"
            className="flex items-center gap-1 self-start rounded-lg bg-[#FDF3F5] p-1 sm:self-auto"
          >
            {(
              [
                { id: 'all', label: 'All Options' },
                { id: 'vegetarian', label: 'Vegetarian' },
                { id: 'non-vegetarian', label: 'Non-Vegetarian' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDietFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  dietFilter === tab.id
                    ? 'bg-white text-[#241118] shadow-xs'
                    : 'text-[#644A52] hover:text-[#241118]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Healthier Alternatives + High Protein Options */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Healthier Alternatives */}
          <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-6">
            <div className="flex items-center gap-2.5">
              <Salad className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-[#241118]">
                Healthier Alternatives
              </h3>
            </div>
            <div className="mt-4 divide-y divide-[#EEDCE0]">
              {dietSuggestions.healthierAlternatives.map((alt, i) => (
                <div key={`${alt.title}-${i}`} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-[#241118]">{alt.title}</p>
                    {alt.estimatedCalorieSavingsKcal > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#15803D] tabular-nums whitespace-nowrap shrink-0">
                        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                        −{alt.estimatedCalorieSavingsKcal} kcal
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#644A52]">{alt.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* High-Protein Options */}
          <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-6">
            <div className="flex items-center gap-2.5">
              <Dumbbell className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-[#241118]">
                High-Protein Food Options
              </h3>
            </div>
            <div className="mt-4 divide-y divide-[#EEDCE0]">
              {dietSuggestions.highProteinOptions.map((opt, i) => (
                <div key={`${opt.title}-${i}`} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-[#241118]">{opt.title}</p>
                    {opt.proteinBoostGrams > 0 && (
                      <span className="font-mono text-xs font-semibold text-[#BE123C] tabular-nums whitespace-nowrap shrink-0">
                        +{opt.proteinBoostGrams} g protein
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#644A52]">{opt.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vegetarian & Non-Vegetarian Alternatives */}
        <div
          className={`mt-6 grid grid-cols-1 gap-6 ${
            dietFilter === 'all' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
          }`}
        >
          {(dietFilter === 'all' || dietFilter === 'vegetarian') && (
            <div className="rounded-2xl border border-[#EEDCE0] bg-white p-6">
              <div className="flex items-center gap-2.5">
                <Leaf className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-[#241118]">
                  Vegetarian Alternatives
                </h3>
              </div>
              <div className="mt-4 divide-y divide-[#F6E9EC]">
                {dietSuggestions.vegetarianOptions.map((opt, i) => (
                  <div key={`${opt.title}-${i}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-[#241118]">{opt.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                      {opt.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(dietFilter === 'all' || dietFilter === 'non-vegetarian') && (
            <div className="rounded-2xl border border-[#EEDCE0] bg-white p-6">
              <div className="flex items-center gap-2.5">
                <UtensilsCrossed className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-[#241118]">
                  Non-Vegetarian Alternatives
                </h3>
              </div>
              <div className="mt-4 divide-y divide-[#F6E9EC]">
                {dietSuggestions.nonVegetarianOptions.map((opt, i) => (
                  <div key={`${opt.title}-${i}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-[#241118]">{opt.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#644A52]">
                      {opt.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
