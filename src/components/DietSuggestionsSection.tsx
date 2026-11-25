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
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] px-4 py-3">
            <p className="font-display text-sm font-bold text-[#241118]">
              AI Diet Recommendations
            </p>
            <p className="mt-0.5 text-xs text-[#644A52]">
              Analyze a meal photo above to unlock calorie-saving swaps, high-protein add-ons, and
              veg / non-veg alternatives.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { dietSuggestions } = analysis;

  return (
    <section id="diet-guide" className="border-b border-[#EEDCE0] bg-white">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#BE123C]">Tailored Nutrition Guidance</p>
            <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight text-[#241118] sm:text-xl">
              AI Diet Suggestions for {analysis.mealTitle}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#644A52] sm:text-sm">
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
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Healthier Alternatives */}
          <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-4">
            <div className="flex items-center gap-2">
              <Salad className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-[#241118]">
                Healthier Alternatives
              </h3>
            </div>
            <div className="mt-3 divide-y divide-[#EEDCE0]">
              {dietSuggestions.healthierAlternatives.map((alt, i) => (
                <div key={`${alt.title}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold text-[#241118] sm:text-sm">{alt.title}</p>
                    {alt.estimatedCalorieSavingsKcal > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#15803D] tabular-nums whitespace-nowrap shrink-0">
                        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                        −{alt.estimatedCalorieSavingsKcal} kcal
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#644A52]">{alt.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* High-Protein Options */}
          <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-[#241118]">
                High-Protein Food Options
              </h3>
            </div>
            <div className="mt-3 divide-y divide-[#EEDCE0]">
              {dietSuggestions.highProteinOptions.map((opt, i) => (
                <div key={`${opt.title}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold text-[#241118] sm:text-sm">{opt.title}</p>
                    {opt.proteinBoostGrams > 0 && (
                      <span className="font-mono text-xs font-semibold text-[#BE123C] tabular-nums whitespace-nowrap shrink-0">
                        +{opt.proteinBoostGrams} g protein
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#644A52]">{opt.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vegetarian & Non-Vegetarian Alternatives */}
        <div
          className={`mt-4 grid grid-cols-1 gap-4 ${
            dietFilter === 'all' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
          }`}
        >
          {(dietFilter === 'all' || dietFilter === 'vegetarian') && (
            <div className="rounded-2xl border border-[#EEDCE0] bg-white p-4">
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-[#241118]">
                  Vegetarian Alternatives
                </h3>
              </div>
              <div className="mt-3 divide-y divide-[#F6E9EC]">
                {dietSuggestions.vegetarianOptions.map((opt, i) => (
                  <div key={`${opt.title}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-[#241118] sm:text-sm">{opt.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#644A52]">
                      {opt.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(dietFilter === 'all' || dietFilter === 'non-vegetarian') && (
            <div className="rounded-2xl border border-[#EEDCE0] bg-white p-4">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-[#241118]">
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
