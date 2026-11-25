import { useMemo, useState } from 'react';
import {
  Apple,
  Eye,
  Loader2,
  Plus,
  Search,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  catalogItemToAnalysis,
  FOOD_CATALOG,
  FOOD_CATALOG_CATEGORIES,
  type FoodCatalogCategory,
  type FoodCatalogItem,
} from '../data/foodCatalog';
import type { FoodAnalysisResult, MealCategory } from '../types/nutrition';

interface FoodExplorerSectionProps {
  onInspectAnalysis: (analysis: FoodAnalysisResult) => void;
  onQuickLogFood: (analysis: FoodAnalysisResult, category: MealCategory) => void;
}

export function FoodExplorerSection({
  onInspectAnalysis,
  onQuickLogFood,
}: FoodExplorerSectionProps) {
  const [activeCategory, setActiveCategory] = useState<'All' | FoodCatalogCategory>('Fruits');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [isAiEstimating, setIsAiEstimating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FOOD_CATALOG.filter((item) => {
      const matchesCat = activeCategory === 'All' || item.category === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.aliases?.toLowerCase().includes(q) ?? false) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  async function handleAiTextEstimate(event: React.FormEvent) {
    event.preventDefault();
    const text = aiQuery.trim();
    if (!text) return;

    setIsAiEstimating(true);
    setAiError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35_000);

    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ query: text }),
      });

      const rawText = await response.text();
      let payload: (FoodAnalysisResult & { error?: string }) | null = null;
      if (rawText) {
        try {
          payload = JSON.parse(rawText) as FoodAnalysisResult & { error?: string };
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to estimate this food right now.');
      }

      if (!payload || typeof payload.identificationStatus !== 'string' || !payload.totals) {
        throw new Error('Received an unexpected response format from the AI estimator.');
      }

      if (payload.identificationStatus === 'not_food') {
        setAiError(
          payload.clarificationQuestion ||
            'That does not appear to be a food or fruit. Try entering a dish, fruit, or drink.'
        );
        return;
      }

      onInspectAnalysis(payload);
    } catch (err) {
      setAiError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Estimation timed out. Please retry.'
          : err instanceof Error
            ? err.message
            : 'Unable to estimate nutrition for this food.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsAiEstimating(false);
    }
  }

  function guessMealCategory(item: FoodCatalogItem): MealCategory {
    if (item.category === 'Fruits' || item.category === 'Nuts & Seeds' || item.category === 'Snacks & Fast Food') {
      return 'Snack';
    }
    if (item.category === 'Grains & Breakfast') return 'Breakfast';
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  }

  const visibleItems =
    showAllItems || searchQuery.trim().length > 0 ? filteredItems : filteredItems.slice(0, 6);

  return (
    <section id="food-directory" className="bg-[#FFF8F9]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Header + Compact AI Custom Estimator */}
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#BE123C]">
              Food &amp; Fruit Nutrition Explorer
            </p>
            <p className="mt-0.5 text-xs text-[#644A52]">
              Filter Indian staples &amp; fruits or estimate any dish by name.
            </p>
          </div>

          <form
            onSubmit={handleAiTextEstimate}
            className="flex w-full max-w-lg flex-col gap-2 sm:flex-row"
          >
            <input
              id="ai-food-query"
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Estimate dish by name (e.g. 2 idli + sambar)"
              aria-label="Estimate any food, fruit, or meal combo by name"
              className="min-h-[42px] flex-1 rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-xs text-[#241118] placeholder:text-[#8E737B] focus:border-[#BE123C] focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              disabled={isAiEstimating || !aiQuery.trim()}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#BE123C] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9F1239] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAiEstimating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Estimating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  AI Estimate
                </>
              )}
            </button>
          </form>
        </div>

        {aiError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{aiError}</span>
          </p>
        )}

        {/* Compact Single-Row Category Filter Tabs + Search Filter */}
        <div className="mt-4 flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
          <div
            role="tablist"
            aria-label="Food and fruit categories"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
          >
            {FOOD_CATALOG_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => {
                  setActiveCategory(category);
                  setShowAllItems(false);
                }}
                className={`min-h-[38px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeCategory === category
                    ? 'bg-[#BE123C] text-white'
                    : 'border border-[#EEDCE0] bg-white text-[#644A52] hover:text-[#241118]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-64 shrink-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#7E6069]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter foods (dosa, mango, roti)..."
              aria-label="Filter food and fruit directory"
              className="min-h-[40px] w-full rounded-xl border border-[#E5CFD4] bg-white py-2 pr-3 pl-9 text-xs text-[#241118] placeholder:text-[#8E737B] focus:border-[#BE123C] focus:outline-none"
            />
          </div>
        </div>

        {/* Catalog Grid */}
        {filteredItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#EEDCE0] bg-white p-6 text-center">
            <Apple className="mx-auto h-6 w-6 text-[#BE123C]" aria-hidden="true" />
            <p className="mt-2 font-display text-sm font-semibold text-[#241118]">
              No matching item for &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => {
                setAiQuery(searchQuery);
                setActiveCategory('All');
              }}
              className="mt-3 min-h-[40px] rounded-lg bg-[#BE123C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#9F1239] cursor-pointer"
            >
              Send &ldquo;{searchQuery}&rdquo; to AI Estimator
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item) => {
                const analysis = catalogItemToAnalysis(item);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-[#EEDCE0] bg-white p-3.5 transition-colors hover:border-[#D9A7B2]"
                  >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[#BE123C]">{item.category}</p>
                        <h3 className="mt-0.5 truncate font-display text-base font-semibold text-[#241118]">
                          {item.name}
                        </h3>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <span className="text-lg font-bold text-[#241118]">
                          {item.caloriesKcal}
                        </span>
                        <span className="ml-1 text-xs text-[#7E6069]">kcal</span>
                      </div>
                    </div>

                    <p className="mt-1 text-xs text-[#7E6069] tabular-nums">
                      {item.servingLabel} ({item.servingGrams} g)
                    </p>

                    <div className="mt-3 grid grid-cols-4 gap-2 border-y border-[#F6E9EC] py-2.5 text-center font-mono text-xs tabular-nums">
                      <div>
                        <p className="font-semibold text-[#241118]">{item.proteinGrams}g</p>
                        <p className="text-[11px] text-[#7E6069]">Protein</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#241118]">{item.carbsGrams}g</p>
                        <p className="text-[11px] text-[#7E6069]">Carbs</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#241118]">{item.fatGrams}g</p>
                        <p className="text-[11px] text-[#7E6069]">Fat</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#241118]">{item.fiberGrams}g</p>
                        <p className="text-[11px] text-[#7E6069]">Fiber</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectAnalysis(analysis)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3 py-1.5 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
                      View Breakdown
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickLogFood(analysis, guessMealCategory(item))}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#BE123C] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9F1239] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Log
                    </button>
                  </div>
                </div>
              );
            })}
            </div>

            {filteredItems.length > 6 && !searchQuery.trim() && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllItems((prev) => !prev)}
                  className="min-h-[42px] rounded-xl border border-[#E5CFD4] bg-white px-5 py-2 text-xs font-semibold text-[#BE123C] transition-colors hover:bg-[#FDF2F4] cursor-pointer"
                >
                  {showAllItems
                    ? 'Show fewer items'
                    : `Show all ${filteredItems.length} ${
                        activeCategory === 'All' ? 'foods' : activeCategory
                      }`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
