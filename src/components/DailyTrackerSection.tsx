import { useMemo, useState } from 'react';
import {
  Calculator,
  Calendar,
  Download,
  Eye,
  SlidersHorizontal,
  Trash2,
  Utensils,
} from 'lucide-react';
import type {
  DailyNutritionGoals,
  TrackedMealEntry,
} from '../types/nutrition';

interface DailyTrackerSectionProps {
  entries: TrackedMealEntry[];
  selectedDateKey: string;
  onChangeDateKey: (dateKey: string) => void;
  dailyGoals: DailyNutritionGoals;
  onUpdateGoals: (goals: DailyNutritionGoals) => void;
  onOpenCalculator: () => void;
  onDeleteEntry: (id: string) => void;
  onClearDay: (dateKey: string) => void;
  onInspectEntry: (entry: TrackedMealEntry) => void;
  onJumpToUpload: () => void;
}

export function DailyTrackerSection({
  entries,
  selectedDateKey,
  onChangeDateKey,
  dailyGoals,
  onUpdateGoals,
  onOpenCalculator,
  onDeleteEntry,
  onClearDay,
  onInspectEntry,
  onJumpToUpload,
}: DailyTrackerSectionProps) {
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<DailyNutritionGoals>(dailyGoals);
  const [confirmClearDay, setConfirmClearDay] = useState(false);

  const recentDates = useMemo(() => {
    const unique = Array.from(new Set(entries.map((e) => e.dateKey))).sort((a, b) =>
      b.localeCompare(a)
    );
    return unique.slice(0, 5);
  }, [entries]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.dateKey === selectedDateKey)
        .sort((a, b) => b.loggedAtIso.localeCompare(a.loggedAtIso)),
    [entries, selectedDateKey]
  );

  const dayTotals = useMemo(() => {
    return dayEntries.reduce(
      (acc, entry) => ({
        caloriesKcal: acc.caloriesKcal + entry.analysis.totals.caloriesKcal,
        proteinGrams:
          Math.round((acc.proteinGrams + entry.analysis.totals.proteinGrams) * 10) / 10,
        carbsGrams:
          Math.round((acc.carbsGrams + entry.analysis.totals.carbsGrams) * 10) / 10,
        fatGrams: Math.round((acc.fatGrams + entry.analysis.totals.fatGrams) * 10) / 10,
        fiberGrams:
          Math.round((acc.fiberGrams + entry.analysis.totals.fiberGrams) * 10) / 10,
      }),
      { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0 }
    );
  }, [dayEntries]);

  function handleSaveGoals(e: React.FormEvent) {
    e.preventDefault();
    onUpdateGoals({
      caloriesKcal: Math.max(500, Math.round(goalDraft.caloriesKcal || 2000)),
      proteinGrams: Math.max(10, Math.round(goalDraft.proteinGrams || 120)),
      carbsGrams: Math.max(10, Math.round(goalDraft.carbsGrams || 225)),
      fatGrams: Math.max(10, Math.round(goalDraft.fatGrams || 65)),
      fiberGrams: Math.max(5, Math.round(goalDraft.fiberGrams || 30)),
    });
    setIsEditingGoals(false);
  }

  function handleExportCsv() {
    if (entries.length === 0) return;
    const headers = [
      'Date',
      'Time',
      'Category',
      'Meal Name',
      'Serving (g)',
      'Calories (kcal)',
      'Protein (g)',
      'Carbs (g)',
      'Fat (g)',
      'Fiber (g)',
    ];
    const rows = entries.map((entry) => {
      const time = new Date(entry.loggedAtIso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const safeTitle = `"${entry.analysis.mealTitle.replace(/"/g, '""')}"`;
      return [
        entry.dateKey,
        time,
        entry.mealCategory,
        safeTitle,
        entry.analysis.estimatedServingSizeGrams,
        entry.analysis.totals.caloriesKcal,
        entry.analysis.totals.proteinGrams,
        entry.analysis.totals.carbsGrams,
        entry.analysis.totals.fatGrams,
        entry.analysis.totals.fiberGrams,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nutriscan-meal-history-${selectedDateKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const macroProgress = [
    {
      label: 'Daily Calories',
      current: dayTotals.caloriesKcal,
      goal: dailyGoals.caloriesKcal,
      unit: 'kcal',
      barColor: 'bg-[#15803D]',
    },
    {
      label: 'Protein',
      current: dayTotals.proteinGrams,
      goal: dailyGoals.proteinGrams,
      unit: 'g',
      barColor: 'bg-[#16A34A]',
    },
    {
      label: 'Carbohydrates',
      current: dayTotals.carbsGrams,
      goal: dailyGoals.carbsGrams,
      unit: 'g',
      barColor: 'bg-[#0D9488]',
    },
    {
      label: 'Fat',
      current: dayTotals.fatGrams,
      goal: dailyGoals.fatGrams,
      unit: 'g',
      barColor: 'bg-[#D97706]',
    },
  ];

  return (
    <section id="daily-tracker" className="bg-[#F8FAF8]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header & Date / Goal / Export Controls */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-medium text-[#15803D]">Local Browser History</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#0F1F16]">
              Daily Food Tracker
            </h2>
            <p className="mt-1 text-sm text-[#475E50]">
              Track daily calories, protein, carbohydrates, and fats across saved meals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4DFD7] bg-white px-3 py-1.5 text-xs font-medium text-[#0F1F16]">
              <Calendar className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
              <span className="sr-only">Select date</span>
              <input
                type="date"
                value={selectedDateKey}
                onChange={(e) => {
                  if (e.target.value) {
                    onChangeDateKey(e.target.value);
                    setConfirmClearDay(false);
                  }
                }}
                className="bg-transparent font-mono text-xs text-[#0F1F16] focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={onOpenCalculator}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4DFD7] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F1F16] transition-colors hover:bg-[#F2F6F3] whitespace-nowrap cursor-pointer"
            >
              <Calculator className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
              Calculate Goal
            </button>

            <button
              type="button"
              onClick={() => {
                setGoalDraft(dailyGoals);
                setIsEditingGoals((prev) => !prev);
              }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4DFD7] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F1F16] transition-colors hover:bg-[#F2F6F3] whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
              {isEditingGoals ? 'Close Targets' : 'Edit Targets'}
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4DFD7] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F1F16] transition-colors hover:bg-[#F2F6F3] whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                Download CSV
              </button>
            )}
          </div>
        </div>

        {/* Recent Logged Dates quick switch */}
        {recentDates.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#5B7063]">
            <span>Recent logged days:</span>
            {recentDates.map((dateKey) => (
              <button
                key={dateKey}
                type="button"
                onClick={() => onChangeDateKey(dateKey)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs tabular-nums transition-colors cursor-pointer ${
                  selectedDateKey === dateKey
                    ? 'bg-[#15803D] font-semibold text-white'
                    : 'bg-white text-[#475E50] border border-[#E2E8E4] hover:text-[#0F1F16]'
                }`}
              >
                {dateKey}
              </button>
            ))}
          </div>
        )}

        {/* Editable Daily Targets Form */}
        {isEditingGoals && (
          <form
            onSubmit={handleSaveGoals}
            className="mt-5 rounded-2xl border border-[#D4DFD7] bg-white p-5"
          >
            <p className="font-display text-sm font-semibold text-[#0F1F16]">
              Customize Daily Nutrition Targets
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {(
                [
                  { key: 'caloriesKcal', label: 'Calories (kcal)' },
                  { key: 'proteinGrams', label: 'Protein (g)' },
                  { key: 'carbsGrams', label: 'Carbs (g)' },
                  { key: 'fatGrams', label: 'Fat (g)' },
                  { key: 'fiberGrams', label: 'Fiber (g)' },
                ] as const
              ).map((field) => (
                <label key={field.key} className="block">
                  <span className="text-xs font-medium text-[#475E50]">{field.label}</span>
                  <input
                    type="number"
                    min={1}
                    value={goalDraft[field.key]}
                    onChange={(e) =>
                      setGoalDraft((prev) => ({
                        ...prev,
                        [field.key]: Number(e.target.value),
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#D4DFD7] px-3 py-2 font-mono text-sm text-[#0F1F16] tabular-nums focus:border-[#15803D] focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditingGoals(false)}
                className="min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-medium text-[#475E50] hover:bg-[#F2F6F3] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[38px] rounded-lg bg-[#15803D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#166534] cursor-pointer"
              >
                Save Targets
              </button>
            </div>
          </form>
        )}

        {/* Daily Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {macroProgress.map((item) => {
            const pct = Math.min(100, Math.round((item.current / Math.max(1, item.goal)) * 100));
            const remaining = Math.max(0, Math.round((item.goal - item.current) * 10) / 10);
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-[#E2E8E4] bg-white p-5"
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium text-[#475E50]">{item.label}</p>
                  <span className="font-mono text-xs text-[#5B7063] tabular-nums">{pct}%</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span className="text-2xl font-bold text-[#0F1F16]">{item.current}</span>
                  <span className="text-xs text-[#5B7063]">
                    / {item.goal} {item.unit}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EEF3EF]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${item.barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#5B7063] tabular-nums">
                  {remaining > 0 ? `${remaining} ${item.unit} remaining` : 'Daily target reached'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Logged Meals List or Empty State */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#E2E8E4] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8E4] px-6 py-4">
            <div className="flex items-center gap-2 text-sm">
              <h3 className="font-display font-semibold text-[#0F1F16]">
                Logged Meals ({dayEntries.length})
              </h3>
              <span className="text-[#9BB0A3]" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-[#475E50] tabular-nums">
                {dayTotals.fiberGrams} g fiber logged
              </span>
            </div>

            {dayEntries.length > 0 && (
              <div>
                {!confirmClearDay ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearDay(true)}
                    className="text-xs font-medium text-[#5B7063] hover:text-red-700 cursor-pointer"
                  >
                    Clear Day
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700">Delete all meals for {selectedDateKey}?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearDay(selectedDateKey);
                        setConfirmClearDay(false);
                      }}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearDay(false)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-[#475E50] hover:bg-[#F2F6F3] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {dayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF6F0] text-[#15803D]">
                <Utensils className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 font-display text-base font-semibold text-[#0F1F16]">
                No meals logged for {selectedDateKey}
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#5B7063]">
                Analyze a meal photo and click &ldquo;Add to Daily Tracker&rdquo; to build your
                daily calorie and macronutrient log.
              </p>
              <button
                type="button"
                onClick={onJumpToUpload}
                className="mt-5 min-h-[40px] rounded-lg bg-[#15803D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] cursor-pointer"
              >
                Scan Your First Meal
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF3EF]">
              {dayEntries.map((entry) => {
                const timeFormatted = new Date(entry.loggedAtIso).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col justify-between gap-4 px-6 py-4 transition-colors hover:bg-[#F8FAF8] sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {entry.imageThumbnailDataUrl ? (
                        <img
                          src={entry.imageThumbnailDataUrl}
                          alt={entry.analysis.mealTitle}
                          className="h-14 w-16 shrink-0 rounded-lg border border-[#E2E8E4] object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-lg border border-[#E2E8E4] bg-[#EEF6F0] text-[#15803D]">
                          <Utensils className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-semibold text-[#0F1F16]">
                          {entry.analysis.mealTitle}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5B7063]">
                          <span>{entry.mealCategory}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{timeFormatted}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {entry.analysis.estimatedServingSizeGrams} g
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
                      <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
                        <div className="text-right">
                          <span className="font-semibold text-[#0F1F16]">
                            {entry.analysis.totals.caloriesKcal}
                          </span>{' '}
                          <span className="text-[#5B7063]">kcal</span>
                        </div>
                        <div className="text-right text-[#475E50]">
                          P {entry.analysis.totals.proteinGrams}g
                        </div>
                        <div className="text-right text-[#475E50]">
                          C {entry.analysis.totals.carbsGrams}g
                        </div>
                        <div className="text-right text-[#475E50]">
                          F {entry.analysis.totals.fatGrams}g
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onInspectEntry(entry)}
                          title="View full analysis in dashboard"
                          aria-label={`Inspect ${entry.analysis.mealTitle}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8E4] bg-white px-3 text-xs font-medium text-[#0F1F16] transition-colors hover:bg-[#EEF6F0] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(entry.id)}
                          title="Delete meal entry"
                          aria-label={`Delete ${entry.analysis.mealTitle}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8E4] bg-white text-[#5B7063] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
