import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Plus,
  Scale,
  Share2,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import type {
  DailyNutritionGoals,
  FoodAnalysisResult,
  MealCategory,
} from '../types/nutrition';
import { NutritionCharts } from './NutritionCharts';

interface ResultsDashboardProps {
  analysis: FoodAnalysisResult | null;
  imagePreviewUrl: string | null;
  dailyGoals: DailyNutritionGoals;
  onAddToTracker: (category: MealCategory, scaledAnalysis: FoodAnalysisResult) => void;
  onShareMeal: (scaledAnalysis: FoodAnalysisResult) => void;
  onJumpToUpload: () => void;
}

const MEAL_CATEGORIES: MealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const PORTION_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function scaleRound1(val: number, factor: number): number {
  return Math.round(val * factor * 10) / 10;
}

export function ResultsDashboard({
  analysis,
  imagePreviewUrl,
  dailyGoals,
  onAddToTracker,
  onShareMeal,
  onJumpToUpload,
}: ResultsDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 15) return 'Lunch';
    if (hour < 21) return 'Dinner';
    return 'Snack';
  });
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1);
  const [justAdded, setJustAdded] = useState(false);

  const scaledAnalysis = useMemo<FoodAnalysisResult | null>(() => {
    if (!analysis) return null;
    if (portionMultiplier === 1) return analysis;

    return {
      ...analysis,
      estimatedServingSizeGrams: Math.round(analysis.estimatedServingSizeGrams * portionMultiplier),
      servingDescription: `${portionMultiplier}x of (${analysis.servingDescription})`,
      totals: {
        caloriesKcal: Math.round(analysis.totals.caloriesKcal * portionMultiplier),
        proteinGrams: scaleRound1(analysis.totals.proteinGrams, portionMultiplier),
        carbsGrams: scaleRound1(analysis.totals.carbsGrams, portionMultiplier),
        fatGrams: scaleRound1(analysis.totals.fatGrams, portionMultiplier),
        fiberGrams: scaleRound1(analysis.totals.fiberGrams, portionMultiplier),
      },
      items: analysis.items.map((item) => ({
        ...item,
        portionGrams: Math.round(item.portionGrams * portionMultiplier),
        caloriesKcal: Math.round(item.caloriesKcal * portionMultiplier),
        proteinGrams: scaleRound1(item.proteinGrams, portionMultiplier),
        carbsGrams: scaleRound1(item.carbsGrams, portionMultiplier),
        fatGrams: scaleRound1(item.fatGrams, portionMultiplier),
        fiberGrams: scaleRound1(item.fiberGrams, portionMultiplier),
      })),
    };
  }, [analysis, portionMultiplier]);

  if (!scaledAnalysis || scaledAnalysis.identificationStatus !== 'identified') {
    return (
      <section id="results" className="border-b border-[#E2E8E4] bg-[#F8FAF8]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-[#E2E8E4] bg-white p-8 text-center sm:flex-row sm:text-left">
            <div className="max-w-xl">
              <h2 className="font-display text-xl font-bold text-[#0F1F16]">
                Nutrition Dashboard
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#475E50]">
                Upload a meal photo or select a sample dish above and click{' '}
                <strong className="font-semibold text-[#0F1F16]">Analyze Food</strong> to view
                calorie totals, macronutrient breakdown charts, serving weight estimates, and
                per-ingredient nutrition facts.
              </p>
            </div>
            <button
              type="button"
              onClick={onJumpToUpload}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D4DFD7] bg-[#F8FAF8] px-5 py-2.5 text-sm font-semibold text-[#0F1F16] transition-colors hover:bg-[#EEF4EF] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Utensils className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
              Scan a Meal
            </button>
          </div>
        </div>
      </section>
    );
  }

  function handleSaveMeal() {
    if (!scaledAnalysis) return;
    onAddToTracker(selectedCategory, scaledAnalysis);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2600);
  }

  const confidenceLabel =
    scaledAnalysis.confidence === 'high'
      ? 'High visual confidence'
      : scaledAnalysis.confidence === 'medium'
        ? 'Moderate visual confidence'
        : 'Low visual confidence';

  const statCards = [
    {
      label: 'Total Calories',
      value: `${scaledAnalysis.totals.caloriesKcal}`,
      unit: 'kcal',
      subtext: 'Estimated energy',
      highlight: true,
    },
    {
      label: 'Protein',
      value: `${scaledAnalysis.totals.proteinGrams}`,
      unit: 'g',
      subtext: `${Math.round(scaledAnalysis.totals.proteinGrams * 4)} kcal`,
      highlight: false,
    },
    {
      label: 'Carbohydrates',
      value: `${scaledAnalysis.totals.carbsGrams}`,
      unit: 'g',
      subtext: `${Math.round(scaledAnalysis.totals.carbsGrams * 4)} kcal`,
      highlight: false,
    },
    {
      label: 'Total Fat',
      value: `${scaledAnalysis.totals.fatGrams}`,
      unit: 'g',
      subtext: `${Math.round(scaledAnalysis.totals.fatGrams * 9)} kcal`,
      highlight: false,
    },
    {
      label: 'Dietary Fiber',
      value: `${scaledAnalysis.totals.fiberGrams}`,
      unit: 'g',
      subtext: 'Digestive fiber',
      highlight: false,
    },
    {
      label: 'Serving Size',
      value: `${scaledAnalysis.estimatedServingSizeGrams}`,
      unit: 'g',
      subtext: scaledAnalysis.servingDescription || 'Estimated portion',
      highlight: false,
    },
  ];

  return (
    <section id="results" className="border-b border-[#E2E8E4] bg-[#F8FAF8]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Estimation disclaimer bar */}
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-[#D4DFD7] bg-white px-4 py-3 text-xs text-[#475E50]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-[#0F1F16]">Estimate Notice:</strong>{' '}
            {scaledAnalysis.estimationDisclaimer}
          </p>
        </div>

        {/* Detected Meal Summary Header + Portion Adjuster + Add to Daily Tracker */}
        <div className="rounded-2xl border border-[#E2E8E4] bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              {imagePreviewUrl && (
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E2E8E4] bg-[#F2F6F3]">
                  <img
                    src={imagePreviewUrl}
                    alt={scaledAnalysis.mealTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#475E50]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {confidenceLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                    {scaledAnalysis.estimatedServingSizeGrams} g ({scaledAnalysis.servingDescription})
                  </span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#0F1F16]">
                  {scaledAnalysis.mealTitle}
                </h2>
                <p className="mt-1 text-xs text-[#5B7063]">
                  {scaledAnalysis.items.length} visible food{' '}
                  {scaledAnalysis.items.length === 1 ? 'component' : 'components'} analyzed
                </p>
              </div>
            </div>

            {/* Meal category & Save to Daily Tracker */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Meal category"
                className="flex items-center gap-1 rounded-lg bg-[#F2F6F3] p-1"
              >
                {MEAL_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-white text-[#0F1F16] shadow-xs'
                        : 'text-[#475E50] hover:text-[#0F1F16]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSaveMeal}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  justAdded
                    ? 'bg-[#0F1F16] text-white'
                    : 'bg-[#15803D] text-white hover:bg-[#166534]'
                }`}
              >
                {justAdded ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    Added to Tracker
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add to Daily Tracker
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onShareMeal(scaledAnalysis)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#D4DFD7] bg-[#F8FAF8] px-4 py-2 text-sm font-medium text-[#0F1F16] transition-colors hover:bg-[#EEF6F0] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                Share
              </button>
            </div>
          </div>

          {/* Interactive Portion Multiplier Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF3EF] pt-4">
            <span className="text-xs font-medium text-[#475E50]">
              Adjust portion eaten to recalculate calories &amp; macros:
            </span>
            <div
              role="group"
              aria-label="Portion multiplier"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F2F6F3] p-1"
            >
              {PORTION_MULTIPLIERS.map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => setPortionMultiplier(factor)}
                  className={`rounded-md px-3 py-1 font-mono text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                    portionMultiplier === factor
                      ? 'bg-white text-[#15803D] shadow-xs'
                      : 'text-[#475E50] hover:text-[#0F1F16]'
                  }`}
                >
                  {factor}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6 Core Nutrition Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border p-4 sm:p-5 ${
                card.highlight
                  ? 'border-[#15803D]/30 bg-[#EEF6F0]'
                  : 'border-[#E2E8E4] bg-white'
              }`}
            >
              <p className="text-xs font-medium text-[#475E50]">{card.label}</p>
              <div className="mt-2 flex items-baseline gap-1 font-mono tabular-nums">
                <span className="text-2xl font-bold text-[#0F1F16]">{card.value}</span>
                <span className="text-xs font-medium text-[#475E50]">{card.unit}</span>
              </div>
              <p className="mt-1 truncate text-xs text-[#5B7063]">{card.subtext}</p>
            </div>
          ))}
        </div>

        {/* Nutrition Charts */}
        <div className="mt-6">
          <NutritionCharts totals={scaledAnalysis.totals} dailyGoals={dailyGoals} />
        </div>

        {/* Detected Multiple Food Items Breakdown Table */}
        {scaledAnalysis.items.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#E2E8E4] bg-white">
            <div className="border-b border-[#E2E8E4] px-6 py-4">
              <h3 className="font-display text-base font-semibold text-[#0F1F16]">
                Detected Food Items Breakdown
              </h3>
              <p className="mt-0.5 text-xs text-[#5B7063]">
                Individual ingredient portions and macro estimates detected in the image
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[#E2E8E4] bg-[#F8FAF8] text-xs font-medium text-[#475E50]">
                  <tr>
                    <th className="px-6 py-3">Food Item</th>
                    <th className="px-4 py-3 text-right">Portion</th>
                    <th className="px-4 py-3 text-right">Calories</th>
                    <th className="px-4 py-3 text-right">Protein</th>
                    <th className="px-4 py-3 text-right">Carbs</th>
                    <th className="px-4 py-3 text-right">Fat</th>
                    <th className="px-6 py-3 text-right">Fiber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3EF]">
                  {scaledAnalysis.items.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`} className="hover:bg-[#F8FAF8] transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-[#0F1F16]">{item.name}</p>
                        <p className="text-xs text-[#5B7063]">{item.preparationNote}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[#475E50] tabular-nums">
                        {item.portionGrams} g
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#0F1F16] tabular-nums">
                        {item.caloriesKcal} kcal
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[#0F1F16] tabular-nums">
                        {item.proteinGrams} g
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[#0F1F16] tabular-nums">
                        {item.carbsGrams} g
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[#0F1F16] tabular-nums">
                        {item.fatGrams} g
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-[#0F1F16] tabular-nums">
                        {item.fiberGrams} g
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
