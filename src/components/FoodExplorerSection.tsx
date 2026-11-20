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
    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });

      const payload = (await response.json()) as FoodAnalysisResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to estimate this food right now.');
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
        err instanceof Error ? err.message : 'Unable to estimate nutrition for this food.'
      );
    } finally {
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

  return (
    <section id="food-directory" className="border-b border-[#EEDCE0] bg-[#FFF8F9]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header + AI Custom Any-Food / Any-Fruit Estimator */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-medium text-[#BE123C]">
              Every Fruit &amp; Favorite Dish
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#241118]">
              Food &amp; Fruit Nutrition Explorer
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#644A52]">
              Browse nutrition facts for 36+ fresh and dried fruits, authentic South Indian tiffins
              &amp; meals, North Indian staples, proteins, grains, nuts, snacks, and drinks—or type
              any custom dish or fruit combination for instant AI estimation.
            </p>
          </div>

          <form
            onSubmit={handleAiTextEstimate}
            className="w-full max-w-lg rounded-2xl border border-[#E5CFD4] bg-white p-3.5"
          >
            <label htmlFor="ai-food-query" className="block text-xs font-medium text-[#644A52]">
              Estimate any food, fruit, or meal combo by name
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="ai-food-query"
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="e.g., 2 idlis, 1 masala dosa with sambar, and filter coffee"
                className="min-h-[42px] flex-1 rounded-lg border border-[#E5CFD4] px-3 py-2 text-sm text-[#241118] placeholder:text-[#8E737B] focus:border-[#BE123C] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isAiEstimating || !aiQuery.trim()}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#BE123C] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9F1239] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAiEstimating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Estimating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Estimate with AI
                  </>
                )}
              </button>
            </div>
            {aiError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{aiError}</span>
              </p>
            )}
          </form>
        </div>

        {/* Category Filter Tabs + Search Filter */}
        <div className="mt-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div
            role="tablist"
            aria-label="Food and fruit categories"
            className="flex flex-wrap items-center gap-1.5"
          >
            {FOOD_CATALOG_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeCategory === category
                    ? 'bg-[#BE123C] text-white'
                    : 'border border-[#EEDCE0] bg-white text-[#644A52] hover:text-[#241118]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#7E6069]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter foods or fruits (e.g. dosa, idli, mango, roti)..."
              aria-label="Filter food and fruit directory"
              className="min-h-[40px] w-full rounded-lg border border-[#E5CFD4] bg-white py-2 pr-3 pl-9 text-xs text-[#241118] placeholder:text-[#8E737B] focus:border-[#BE123C] focus:outline-none"
            />
          </div>
        </div>

        {/* Catalog Grid */}
        {filteredItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-[#EEDCE0] bg-white p-8 text-center">
            <Apple className="mx-auto h-7 w-7 text-[#BE123C]" aria-hidden="true" />
            <p className="mt-2 font-display text-sm font-semibold text-[#241118]">
              No matching item in quick directory for &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="mt-1 text-xs text-[#7E6069]">
              Use the &ldquo;Estimate with AI&rdquo; bar above to analyze any dish or fruit in the
              world.
            </p>
            <button
              type="button"
              onClick={() => {
                setAiQuery(searchQuery);
                setActiveCategory('All');
              }}
              className="mt-4 min-h-[38px] rounded-lg bg-[#BE123C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#9F1239] cursor-pointer"
            >
              Send &ldquo;{searchQuery}&rdquo; to AI Estimator
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const analysis = catalogItemToAnalysis(item);
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#EEDCE0] bg-white p-5 transition-colors hover:border-[#D9A7B2]"
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
        )}
      </div>
    </section>
  );
}
