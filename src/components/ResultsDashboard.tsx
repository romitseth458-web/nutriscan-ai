import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  Share2,
  ShieldCheck,
  Trash2,
  Utensils,
} from 'lucide-react';
import {
  computeMacrosFromReference,
  findIndianFoodReference,
  type IndianFoodReferenceEntry,
} from '../data/indianFoodReferenceDb';
import type {
  DailyNutritionGoals,
  DetectedFoodItem,
  FoodAnalysisResult,
  MacroTotals,
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

function round1(val: number): number {
  return Math.round(Math.max(0, val) * 10) / 10;
}

function scaleItemToGrams(item: DetectedFoodItem, targetGrams: number): DetectedFoodItem {
  const safeGrams = Math.max(5, Math.min(2500, Math.round(targetGrams)));
  if (item.nutritionSource === 'unavailable') {
    return { ...item, portionGrams: safeGrams };
  }

  const baseGrams = Math.max(1, item.portionGrams);
  const factor = safeGrams / baseGrams;
  return {
    ...item,
    portionGrams: safeGrams,
    caloriesKcal: Math.round(item.caloriesKcal * factor),
    proteinGrams: round1(item.proteinGrams * factor),
    carbsGrams: round1(item.carbsGrams * factor),
    fatGrams: round1(item.fatGrams * factor),
    fiberGrams: round1(item.fiberGrams * factor),
  };
}

function getNutritionSourceLabel(source?: DetectedFoodItem['nutritionSource']): string {
  if (source === 'reference_db') return 'IFCT / USDA Reference';
  if (source === 'unavailable') return 'Estimate unavailable — edit dish';
  return 'AI Visual Estimate';
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
  const [editableItems, setEditableItems] = useState<DetectedFoodItem[]>([]);
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [userConfirmedUncertain, setUserConfirmedUncertain] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setPortionMultiplier(1);
    setEditableItems(analysis?.items ? analysis.items.map((item) => ({ ...item })) : []);
    setHasManualEdits(false);
    setUserConfirmedUncertain(false);
    setJustAdded(false);
  }, [analysis]);

  const hasUnavailableItem = useMemo(
    () => editableItems.some((item) => item.nutritionSource === 'unavailable'),
    [editableItems]
  );

  const editedAnalysis = useMemo<FoodAnalysisResult | null>(() => {
    if (!analysis) return null;

    if (editableItems.length === 0) {
      return {
        ...analysis,
        estimatedServingSizeGrams: 0,
        servingDescription: 'No items selected',
        totals: {
          caloriesKcal: 0,
          proteinGrams: 0,
          carbsGrams: 0,
          fatGrams: 0,
          fiberGrams: 0,
        },
        items: [],
      };
    }

    const totals: MacroTotals = {
      caloriesKcal: Math.round(
        editableItems.reduce((sum, item) => sum + (item.caloriesKcal || 0), 0)
      ),
      proteinGrams: round1(editableItems.reduce((sum, item) => sum + (item.proteinGrams || 0), 0)),
      carbsGrams: round1(editableItems.reduce((sum, item) => sum + (item.carbsGrams || 0), 0)),
      fatGrams: round1(editableItems.reduce((sum, item) => sum + (item.fatGrams || 0), 0)),
      fiberGrams: round1(editableItems.reduce((sum, item) => sum + (item.fiberGrams || 0), 0)),
    };

    const estimatedServingSizeGrams = Math.round(
      editableItems.reduce((sum, item) => sum + (item.portionGrams || 0), 0)
    );

    const servingDescription = hasManualEdits
      ? `Adjusted (${editableItems.length} ${editableItems.length === 1 ? 'item' : 'items'})`
      : portionMultiplier === 1
        ? analysis.servingDescription
        : `${portionMultiplier}x of (${analysis.servingDescription})`;

    return {
      ...analysis,
      estimatedServingSizeGrams,
      servingDescription,
      totals,
      items: editableItems,
    };
  }, [analysis, editableItems, hasManualEdits, portionMultiplier]);

  if (!editedAnalysis || editedAnalysis.identificationStatus !== 'identified') {
    return (
      <section id="results" className="border-b border-[#EEDCE0] bg-[#FFF8F9]">
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#EEDCE0] bg-white p-5 text-center sm:flex-row sm:text-left">
            <div className="max-w-xl">
              <h2 className="font-display text-lg font-bold text-[#241118]">
                Nutrition Dashboard
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#644A52] sm:text-sm">
                Upload a meal photo or tap a sample Indian dish above and click{' '}
                <strong className="font-semibold text-[#241118]">Analyze Food</strong> for calories,
                oil/ghee notes, and editable gram portions.
              </p>
            </div>
            <button
              type="button"
              onClick={onJumpToUpload}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-4 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] whitespace-nowrap shrink-0 cursor-pointer sm:text-sm"
            >
              <Utensils className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              Scan a Meal
            </button>
          </div>
        </div>
      </section>
    );
  }

  const requiresConfirmationGate =
    editedAnalysis.confidence === 'low' ||
    Boolean(editedAnalysis.requiresUserConfirmation) ||
    hasUnavailableItem;
  const canSaveMeal =
    editableItems.length > 0 && (!requiresConfirmationGate || userConfirmedUncertain);

  function handleApplyMultiplier(factor: number) {
    if (!analysis) return;
    setPortionMultiplier(factor);
    setHasManualEdits(false);
    setEditableItems(
      analysis.items.map((item) => scaleItemToGrams(item, item.portionGrams * factor))
    );
  }

  function handleResetEdits() {
    if (!analysis) return;
    setPortionMultiplier(1);
    setHasManualEdits(false);
    setEditableItems(analysis.items.map((item) => ({ ...item })));
  }

  function handleUpdateItemName(index: number, nextName: string) {
    setHasManualEdits(true);
    setEditableItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, name: nextName } : item))
    );
  }

  function handleUpdateItemGrams(index: number, nextGrams: number) {
    if (!Number.isFinite(nextGrams)) return;
    setHasManualEdits(true);
    setEditableItems((prev) =>
      prev.map((item, idx) => (idx === index ? scaleItemToGrams(item, nextGrams) : item))
    );
  }

  function handleApplyReferenceMatch(index: number, refEntry: IndianFoodReferenceEntry) {
    setHasManualEdits(true);
    setEditableItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const targetGrams = item.portionGrams > 0 ? item.portionGrams : refEntry.defaultPortionGrams;
        const macros = computeMacrosFromReference(refEntry, targetGrams);
        return {
          ...item,
          name: refEntry.name,
          hindiName: refEntry.hindiName,
          regionalCuisine: refEntry.regionalCuisine,
          cookingMethod: refEntry.defaultCookingMethod,
          keyIngredients: refEntry.defaultIngredients,
          oilGheeSugarNote: refEntry.defaultOilGheeSugarNote,
          preparationNote: refEntry.defaultCookingMethod,
          nutritionSource: 'reference_db',
          referenceFoodId: refEntry.id,
          confidence: 'high',
          portionGrams: targetGrams,
          ...macros,
        };
      })
    );
  }

  function handleRemoveItem(index: number) {
    setHasManualEdits(true);
    setEditableItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleAddCustomDish() {
    const defaultRef = findIndianFoodReference('roti');
    const grams = defaultRef?.defaultPortionGrams || 80;
    const macros = defaultRef
      ? computeMacrosFromReference(defaultRef, grams)
      : { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 };

    setHasManualEdits(true);
    setEditableItems((prev) => [
      ...prev,
      {
        name: defaultRef?.name || 'Custom Dish',
        hindiName: defaultRef?.hindiName || '',
        regionalCuisine: defaultRef?.regionalCuisine || 'Indian',
        cookingMethod: defaultRef?.defaultCookingMethod || 'Home-cooked',
        keyIngredients: defaultRef?.defaultIngredients || [],
        oilGheeSugarNote: defaultRef?.defaultOilGheeSugarNote || '',
        preparationNote: defaultRef?.defaultCookingMethod || 'User added item',
        nutritionSource: defaultRef ? 'reference_db' : 'unavailable',
        referenceFoodId: defaultRef?.id,
        confidence: defaultRef ? 'high' : 'low',
        portionGrams: grams,
        ...macros,
      },
    ]);
  }

  function handleSaveMeal() {
    if (!editedAnalysis || !canSaveMeal) return;
    onAddToTracker(selectedCategory, editedAnalysis);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2600);
  }

  const confidenceLabel =
    editedAnalysis.confidence === 'high'
      ? 'High visual confidence'
      : editedAnalysis.confidence === 'medium'
        ? 'Moderate visual confidence'
        : 'Low visual confidence — review before saving';

  const statCards = [
    {
      label: 'Total Calories',
      value: `${editedAnalysis.totals.caloriesKcal}`,
      unit: 'kcal',
      subtext: 'Estimated meal energy',
      highlight: true,
    },
    {
      label: 'Protein',
      value: `${editedAnalysis.totals.proteinGrams}`,
      unit: 'g',
      subtext: `${Math.round(editedAnalysis.totals.proteinGrams * 4)} kcal`,
      highlight: false,
    },
    {
      label: 'Carbohydrates',
      value: `${editedAnalysis.totals.carbsGrams}`,
      unit: 'g',
      subtext: `${Math.round(editedAnalysis.totals.carbsGrams * 4)} kcal`,
      highlight: false,
    },
    {
      label: 'Total Fat',
      value: `${editedAnalysis.totals.fatGrams}`,
      unit: 'g',
      subtext: `${Math.round(editedAnalysis.totals.fatGrams * 9)} kcal`,
      highlight: false,
    },
    {
      label: 'Dietary Fiber',
      value: `${editedAnalysis.totals.fiberGrams}`,
      unit: 'g',
      subtext: 'Digestive fiber',
      highlight: false,
    },
    {
      label: 'Total Weight',
      value: `${editedAnalysis.estimatedServingSizeGrams}`,
      unit: 'g',
      subtext: editedAnalysis.servingDescription || 'Estimated portion',
      highlight: false,
    },
  ];

  return (
    <section id="results" className="border-b border-[#EEDCE0] bg-[#FFF8F9]">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Honest estimation disclaimer bar */}
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#E5CFD4] bg-white px-3.5 py-2.5 text-xs text-[#644A52]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#BE123C]" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-[#241118]">Estimated Nutrition Values:</strong>{' '}
            {editedAnalysis.estimationDisclaimer}
          </p>
        </div>

        {/* Detected Meal Summary Header + Portion Adjuster + Add to Daily Diary */}
        <div className="rounded-2xl border border-[#EEDCE0] bg-white p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              {imagePreviewUrl && (
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-[#EEDCE0] bg-[#FDF3F5]">
                  <img
                    src={imagePreviewUrl}
                    alt={editedAnalysis.mealTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#644A52]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#BE123C]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {confidenceLabel}
                  </span>
                  {editedAnalysis.cuisineRegion && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#241118]">
                        {editedAnalysis.cuisineRegion}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                    {editedAnalysis.estimatedServingSizeGrams} g
                  </span>
                </div>
                <h2 className="mt-0.5 font-display text-lg font-bold tracking-tight text-[#241118] sm:text-xl">
                  {editedAnalysis.mealTitle}
                </h2>
                <p className="mt-0.5 text-xs text-[#7E6069]">
                  {editableItems.length} food{' '}
                  {editableItems.length === 1 ? 'item' : 'items'} · Edit dish names or grams below
                </p>
              </div>
            </div>

            {/* Meal category & Save to Daily Tracker */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Meal category"
                className="flex items-center gap-1 rounded-lg bg-[#FDF3F5] p-1"
              >
                {MEAL_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-white text-[#241118] shadow-xs'
                        : 'text-[#644A52] hover:text-[#241118]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!canSaveMeal}
                onClick={handleSaveMeal}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  justAdded
                    ? 'bg-[#241118] text-white'
                    : 'bg-[#BE123C] text-white hover:bg-[#9F1239]'
                }`}
              >
                {justAdded ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-rose-300" aria-hidden="true" />
                    Added to Diary
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add to Daily Diary
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onShareMeal(editedAnalysis)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-4 py-2 text-sm font-medium text-[#241118] transition-colors hover:bg-[#FDF2F4] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                Share
              </button>
            </div>
          </div>

          {/* Uncertainty confirmation gate */}
          {requiresConfirmationGate && (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <div className="flex-1 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold">
                    Confirmation required before saving uncertain estimates
                  </p>
                  <p className="mt-1 text-amber-900">
                    Some items in this scan had low visual certainty or missing verified data.
                    Please edit the dish names or gram portions below so you never save invented
                    calories.
                  </p>
                  <label className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center gap-2.5 font-medium text-[#241118]">
                    <input
                      type="checkbox"
                      checked={userConfirmedUncertain}
                      onChange={(e) => setUserConfirmedUncertain(e.target.checked)}
                      className="h-4 w-4 accent-[#BE123C]"
                    />
                    <span>I reviewed and confirmed these dish names and portion estimates</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Portion Multiplier Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F6E9EC] pt-4">
            <span className="text-xs font-medium text-[#644A52]">
              Scale whole plate portions (updates individual dish grams below):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Portion multiplier"
                className="flex flex-wrap items-center gap-1 rounded-lg bg-[#FDF3F5] p-1"
              >
                {PORTION_MULTIPLIERS.map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => handleApplyMultiplier(factor)}
                    className={`min-h-[34px] rounded-md px-3 py-1 font-mono text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                      !hasManualEdits && portionMultiplier === factor
                        ? 'bg-white text-[#BE123C] shadow-xs'
                        : 'text-[#644A52] hover:text-[#241118]'
                    }`}
                  >
                    {factor}×
                  </button>
                ))}
              </div>
              {(hasManualEdits || portionMultiplier !== 1) && (
                <button
                  type="button"
                  onClick={handleResetEdits}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-white px-3 py-1 text-xs font-medium text-[#241118] hover:bg-[#FDF2F4] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
                  Reset Scan
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 6 Core Nutrition Cards */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 lg:grid-cols-6">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border p-3 ${
                card.highlight
                  ? 'border-[#BE123C]/30 bg-[#FDF2F4]'
                  : 'border-[#EEDCE0] bg-white'
              }`}
            >
              <p className="truncate text-[11px] font-medium text-[#644A52]">{card.label}</p>
              <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                <span className="text-lg font-bold text-[#241118] sm:text-xl">{card.value}</span>
                <span className="text-[11px] font-medium text-[#644A52]">{card.unit}</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-[#7E6069]">{card.subtext}</p>
            </div>
          ))}
        </div>

        {/* Nutrition Charts */}
        <div className="mt-4">
          <NutritionCharts totals={editedAnalysis.totals} dailyGoals={dailyGoals} />
        </div>

        {/* Editable Multi-Item Indian & Meal Breakdown */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEDCE0] px-4 py-3 sm:px-5">
            <div>
              <h3 className="font-display text-base font-semibold text-[#241118]">
                Plate Items &amp; Editable Portions
              </h3>
              <p className="mt-0.5 text-xs text-[#7E6069]">
                Rename any dish (Hindi or English) to check IFCT/USDA values or adjust grams
                before logging
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddCustomDish}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3.5 py-2 text-xs font-semibold text-[#241118] hover:bg-[#FDF2F4] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
              Add Dish
            </button>
          </div>

          {editableItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#644A52]">
              No items left in this meal. Click{' '}
              <strong className="font-semibold text-[#241118]">Add Dish</strong> or{' '}
              <strong className="font-semibold text-[#241118]">Reset Scan</strong> to restore
              detected foods.
            </div>
          ) : (
            <>
              {/* Android-friendly stacked mobile cards */}
              <div className="divide-y divide-[#F6E9EC] md:hidden">
                {editableItems.map((item, idx) => {
                  const refMatch = findIndianFoodReference(item.name);
                  const canApplyMatch =
                    refMatch &&
                    (item.referenceFoodId !== refMatch.id ||
                      item.nutritionSource !== 'reference_db');
                  const sourceText = getNutritionSourceLabel(item.nutritionSource);

                  return (
                    <div key={`mobile-item-${idx}`} className="space-y-3 p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-1">
                          <label className="sr-only" htmlFor={`mobile-dish-name-${idx}`}>
                            Dish name
                          </label>
                          <input
                            id={`mobile-dish-name-${idx}`}
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItemName(idx, e.target.value)}
                            className="min-h-[44px] w-full rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3 py-2 text-sm font-semibold text-[#241118] focus:border-[#BE123C] focus:bg-white focus:outline-none"
                          />
                          {item.hindiName && (
                            <p className="text-xs font-medium text-[#BE123C]">{item.hindiName}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          aria-label={`Remove ${item.name}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#EEDCE0] bg-white text-[#7E6069] hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {canApplyMatch && (
                        <button
                          type="button"
                          onClick={() => handleApplyReferenceMatch(idx, refMatch)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#BE123C]/30 bg-[#FDF2F4] px-3 py-1.5 text-xs font-semibold text-[#BE123C] hover:bg-[#FCE7EB] cursor-pointer"
                        >
                          <Database className="h-3.5 w-3.5" aria-hidden="true" />
                          Apply IFCT/USDA ref: {refMatch.name}
                        </button>
                      )}

                      {/* Unboxed metadata typography (no pill clutter) */}
                      <div className="space-y-1 text-xs text-[#644A52]">
                        <p>
                          {[item.regionalCuisine, item.cookingMethod || item.preparationNote, sourceText]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {item.keyIngredients && item.keyIngredients.length > 0 && (
                          <p className="text-[#7E6069]">
                            Ingredients: {item.keyIngredients.join(', ')}
                          </p>
                        )}
                        {item.oilGheeSugarNote && (
                          <p className="text-[#7E6069]">Oil/Ghee/Sugar: {item.oilGheeSugarNote}</p>
                        )}
                      </div>

                      {/* Mobile 44px gram stepper */}
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-[#FFF8F9] p-2.5 border border-[#F0DFE3]">
                        <span className="text-xs font-medium text-[#644A52]">Portion (g)</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemGrams(idx, Math.max(5, item.portionGrams - 10))
                            }
                            aria-label={`Decrease grams for ${item.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5CFD4] bg-white text-[#241118] hover:bg-[#FDF2F4] cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={5}
                            max={2500}
                            value={item.portionGrams}
                            onChange={(e) =>
                              handleUpdateItemGrams(idx, Number.parseInt(e.target.value, 10))
                            }
                            aria-label={`Portion grams for ${item.name}`}
                            className="h-10 w-20 rounded-lg border border-[#E5CFD4] bg-white px-2 text-center font-mono text-sm font-semibold text-[#241118] tabular-nums focus:border-[#BE123C] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateItemGrams(idx, item.portionGrams + 10)}
                            aria-label={`Increase grams for ${item.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5CFD4] bg-white text-[#241118] hover:bg-[#FDF2F4] cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Tabular macro strip */}
                      <div className="grid grid-cols-5 gap-2 rounded-xl border border-[#F6E9EC] bg-[#FFFDFD] px-3 py-2 text-center font-mono tabular-nums">
                        <div>
                          <p className="text-[11px] font-sans text-[#7E6069]">Kcal</p>
                          <p className="text-xs font-bold text-[#BE123C]">
                            {item.nutritionSource === 'unavailable' ? '—' : item.caloriesKcal}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-sans text-[#7E6069]">Prot</p>
                          <p className="text-xs font-semibold text-[#241118]">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.proteinGrams}g`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-sans text-[#7E6069]">Carbs</p>
                          <p className="text-xs font-semibold text-[#241118]">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.carbsGrams}g`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-sans text-[#7E6069]">Fat</p>
                          <p className="text-xs font-semibold text-[#241118]">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.fatGrams}g`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-sans text-[#7E6069]">Fiber</p>
                          <p className="text-xs font-semibold text-[#241118]">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.fiberGrams}g`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[#EEDCE0] bg-[#FFF8F9] text-xs font-medium text-[#644A52]">
                    <tr>
                      <th className="px-6 py-3">Food Item (Editable)</th>
                      <th className="px-4 py-3 text-center">Portion (g)</th>
                      <th className="px-4 py-3 text-right">Calories</th>
                      <th className="px-4 py-3 text-right">Protein</th>
                      <th className="px-4 py-3 text-right">Carbs</th>
                      <th className="px-4 py-3 text-right">Fat</th>
                      <th className="px-4 py-3 text-right">Fiber</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F6E9EC]">
                    {editableItems.map((item, idx) => {
                      const refMatch = findIndianFoodReference(item.name);
                      const canApplyMatch =
                        refMatch &&
                        (item.referenceFoodId !== refMatch.id ||
                          item.nutritionSource !== 'reference_db');
                      const sourceText = getNutritionSourceLabel(item.nutritionSource);

                      return (
                        <tr
                          key={`desktop-item-${idx}`}
                          className="align-top transition-colors hover:bg-[#FFF8F9]"
                        >
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItemName(idx, e.target.value)}
                              aria-label={`Edit food name for row ${idx + 1}`}
                              className="min-h-[38px] w-full max-w-sm rounded-lg border border-[#E5CFD4] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#241118] focus:border-[#BE123C] focus:outline-none"
                            />
                            {item.hindiName && (
                              <p className="mt-1 text-xs font-medium text-[#BE123C]">
                                {item.hindiName}
                              </p>
                            )}
                            {canApplyMatch && (
                              <button
                                type="button"
                                onClick={() => handleApplyReferenceMatch(idx, refMatch)}
                                className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[#BE123C]/30 bg-[#FDF2F4] px-2.5 py-1 text-xs font-semibold text-[#BE123C] hover:bg-[#FCE7EB] cursor-pointer"
                              >
                                <Database className="h-3 w-3" aria-hidden="true" />
                                Apply IFCT/USDA ref: {refMatch.name}
                              </button>
                            )}
                            <p className="mt-1.5 text-xs text-[#644A52]">
                              {[
                                item.regionalCuisine,
                                item.cookingMethod || item.preparationNote,
                                sourceText,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {item.keyIngredients && item.keyIngredients.length > 0 && (
                              <p className="mt-0.5 text-xs text-[#7E6069]">
                                Ingredients: {item.keyIngredients.join(', ')}
                              </p>
                            )}
                            {item.oilGheeSugarNote && (
                              <p className="mt-0.5 text-xs text-[#7E6069]">
                                Oil/Ghee/Sugar: {item.oilGheeSugarNote}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateItemGrams(idx, Math.max(5, item.portionGrams - 10))
                                }
                                aria-label={`Decrease grams for ${item.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5CFD4] bg-white text-[#241118] hover:bg-[#FDF2F4] cursor-pointer"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={5}
                                max={2500}
                                value={item.portionGrams}
                                onChange={(e) =>
                                  handleUpdateItemGrams(idx, Number.parseInt(e.target.value, 10))
                                }
                                aria-label={`Portion grams for ${item.name}`}
                                className="h-8 w-16 rounded-md border border-[#E5CFD4] bg-white px-1.5 text-center font-mono text-xs font-semibold text-[#241118] tabular-nums focus:border-[#BE123C] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemGrams(idx, item.portionGrams + 10)}
                                aria-label={`Increase grams for ${item.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5CFD4] bg-white text-[#241118] hover:bg-[#FDF2F4] cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right font-mono font-semibold text-[#241118] tabular-nums">
                            {item.nutritionSource === 'unavailable'
                              ? '—'
                              : `${item.caloriesKcal} kcal`}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-xs text-[#241118] tabular-nums">
                            {item.nutritionSource === 'unavailable'
                              ? '—'
                              : `${item.proteinGrams} g`}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-xs text-[#241118] tabular-nums">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.carbsGrams} g`}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-xs text-[#241118] tabular-nums">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.fatGrams} g`}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-xs text-[#241118] tabular-nums">
                            {item.nutritionSource === 'unavailable' ? '—' : `${item.fiberGrams} g`}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              aria-label={`Remove ${item.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#7E6069] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

