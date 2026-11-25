import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BookmarkCheck,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  History,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  DailyNutritionGoals,
  TrackedMealEntry,
  UserDietProfile,
  WaterLogEntry,
  WeeklyMetricsSnapshot,
  WeeklyReportAiFeedback,
  WeeklyReportRecord,
  WeeklyTrendMetric,
} from '../types/nutrition';
import {
  buildWeeklyMetricsSnapshot,
  parseLocalDateKey,
  requestWeeklyAiSummary,
  shiftLocalDateKey,
} from '../services/weeklyReportService';

interface WeeklyReportSectionProps {
  meals: TrackedMealEntry[];
  waterLogs: WaterLogEntry[];
  dailyGoals: DailyNutritionGoals;
  waterGoalMl: number;
  todayDateKey: string;
  dietProfile?: UserDietProfile;
  savedReports: WeeklyReportRecord[];
  isEmailVerified: boolean;
  onSaveWeeklyReport: (
    report: Omit<WeeklyReportRecord, 'id' | 'updatedAtIso'> & { id?: string }
  ) => Promise<string>;
  onDeleteWeeklyReport: (reportId: string) => Promise<void>;
  onShowToast: (message: string) => void;
}

const METRIC_OPTIONS: {
  id: WeeklyTrendMetric;
  label: string;
  unit: string;
  isWater?: boolean;
}[] = [
  { id: 'calories', label: 'Calories', unit: 'kcal' },
  { id: 'protein', label: 'Protein', unit: 'g' },
  { id: 'carbs', label: 'Carbs', unit: 'g' },
  { id: 'fat', label: 'Fat', unit: 'g' },
  { id: 'fiber', label: 'Fiber', unit: 'g' },
  { id: 'water', label: 'Water', unit: 'ml', isWater: true },
];

function formatRangeLabel(startDateKey: string, endDateKey: string): string {
  const start = parseLocalDateKey(startDateKey);
  const end = parseLocalDateKey(endDateKey);
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const endYear = end.getFullYear();
  return `${fmt.format(start)} – ${fmt.format(end)}, ${endYear}`;
}

function formatDayColumn(dateKey: string, todayKey: string): { weekday: string; shortDate: string } {
  if (dateKey === todayKey) {
    return { weekday: 'Today', shortDate: dateKey.slice(5) };
  }
  const dt = parseLocalDateKey(dateKey);
  return {
    weekday: dt.toLocaleDateString(undefined, { weekday: 'short' }),
    shortDate: dateKey.slice(5),
  };
}

function getMetricValueForDay(
  day: WeeklyMetricsSnapshot['days'][number],
  metric: WeeklyTrendMetric
): number {
  switch (metric) {
    case 'calories':
      return day.caloriesKcal;
    case 'protein':
      return day.proteinGrams;
    case 'carbs':
      return day.carbsGrams;
    case 'fat':
      return day.fatGrams;
    case 'fiber':
      return day.fiberGrams;
    case 'water':
      return day.waterMl;
  }
}

export function WeeklyReportSection({
  meals,
  waterLogs,
  dailyGoals,
  waterGoalMl,
  todayDateKey,
  dietProfile,
  savedReports,
  isEmailVerified,
  onSaveWeeklyReport,
  onDeleteWeeklyReport,
  onShowToast,
}: WeeklyReportSectionProps) {
  const [selectedEndDateKey, setSelectedEndDateKey] = useState<string>(todayDateKey);
  const [activeMetric, setActiveMetric] = useState<WeeklyTrendMetric>('calories');
  const [viewingSavedId, setViewingSavedId] = useState<string | null>(null);

  const [generatedAiByWeek, setGeneratedAiByWeek] = useState<Record<string, WeeklyReportAiFeedback>>(
    {}
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const [lastKnownToday, setLastKnownToday] = useState(todayDateKey);
  useEffect(() => {
    if (todayDateKey !== lastKnownToday) {
      if (selectedEndDateKey === lastKnownToday) {
        setSelectedEndDateKey(todayDateKey);
      }
      setLastKnownToday(todayDateKey);
    }
  }, [todayDateKey, lastKnownToday, selectedEndDateKey]);

  // Compute live snapshot strictly from logged meals & water entries
  const liveSnapshot = useMemo(
    () =>
      buildWeeklyMetricsSnapshot({
        meals,
        waterLogs,
        endDateKey: selectedEndDateKey,
        dailyGoals,
        dailyWaterGoalMl: waterGoalMl,
      }),
    [meals, waterLogs, selectedEndDateKey, dailyGoals, waterGoalMl]
  );

  // Match any saved Firestore report for the selected endDateKey or explicitly selected saved ID
  const matchedSavedReport = useMemo(() => {
    if (viewingSavedId) {
      return savedReports.find((r) => r.id === viewingSavedId) || null;
    }
    return savedReports.find((r) => r.endDateKey === selectedEndDateKey) || null;
  }, [savedReports, viewingSavedId, selectedEndDateKey]);

  const isViewingSavedSnapshot = Boolean(
    viewingSavedId && matchedSavedReport && matchedSavedReport.id === viewingSavedId
  );

  // Active metrics displayed in KPI cards & trend chart:
  // If user clicked a historical saved report, show its preserved snapshot; otherwise live diary data.
  const activeMetrics: WeeklyMetricsSnapshot = useMemo(() => {
    if (isViewingSavedSnapshot && matchedSavedReport) {
      const waterDays = matchedSavedReport.days.filter((d) => d.waterMl > 0).length;
      const goalMetDays = matchedSavedReport.days.filter(
        (d) => d.waterMl >= matchedSavedReport.dailyWaterGoalMl
      ).length;
      return {
        startDateKey: matchedSavedReport.startDateKey,
        endDateKey: matchedSavedReport.endDateKey,
        loggedMealDaysCount: matchedSavedReport.loggedMealDaysCount,
        loggedWaterDaysCount: waterDays,
        waterGoalMetDaysCount: goalMetDays,
        totalMealsLogged: matchedSavedReport.totalMealsLogged,
        dailyAverageTotals: matchedSavedReport.dailyAverageTotals,
        weeklyTotals: matchedSavedReport.weeklyTotals,
        dailyWaterGoalMl: matchedSavedReport.dailyWaterGoalMl,
        averageWaterMl: matchedSavedReport.averageWaterMl,
        totalWaterMl: matchedSavedReport.totalWaterMl,
        dailyGoalsSnapshot: matchedSavedReport.dailyGoalsSnapshot,
        days: matchedSavedReport.days,
      };
    }
    return liveSnapshot;
  }, [isViewingSavedSnapshot, matchedSavedReport, liveSnapshot]);

  // Resolve AI feedback for current week (newly generated takes precedence, otherwise saved report)
  const activeAiFeedback: WeeklyReportAiFeedback | null = useMemo(() => {
    if (isViewingSavedSnapshot && matchedSavedReport) {
      return {
        aiSummary: matchedSavedReport.aiSummary,
        highlights: matchedSavedReport.highlights,
        suggestions: matchedSavedReport.suggestions,
        estimationDisclaimer: matchedSavedReport.estimationDisclaimer,
      };
    }
    const freshlyGenerated = generatedAiByWeek[selectedEndDateKey];
    if (freshlyGenerated) return freshlyGenerated;
    if (matchedSavedReport) {
      return {
        aiSummary: matchedSavedReport.aiSummary,
        highlights: matchedSavedReport.highlights,
        suggestions: matchedSavedReport.suggestions,
        estimationDisclaimer: matchedSavedReport.estimationDisclaimer,
      };
    }
    return null;
  }, [isViewingSavedSnapshot, matchedSavedReport, generatedAiByWeek, selectedEndDateKey]);

  function handleSelectWeekEndDate(nextEndDateKey: string) {
    const clamped = nextEndDateKey > todayDateKey ? todayDateKey : nextEndDateKey;
    setViewingSavedId(null);
    setSelectedEndDateKey(clamped);
    setAiError(null);
  }

  function handleSelectSavedReport(report: WeeklyReportRecord) {
    setViewingSavedId(report.id);
    setSelectedEndDateKey(report.endDateKey);
    setAiError(null);
  }

  async function handleGenerateAiSummary() {
    if (isGenerating || activeMetrics.loggedMealDaysCount < 2) return;
    setAiError(null);
    setIsGenerating(true);
    try {
      const feedback = await requestWeeklyAiSummary({
        snapshot: liveSnapshot,
        dietaryPreference: dietProfile?.dietaryPreference,
        fitnessGoal: dietProfile?.fitnessGoal,
      });
      setViewingSavedId(null);
      setGeneratedAiByWeek((prev) => ({
        ...prev,
        [selectedEndDateKey]: feedback,
      }));
      onShowToast('Weekly nutrition summary generated');
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Could not generate AI weekly summary right now.'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveReport() {
    if (isSavingReport || !activeAiFeedback) return;
    if (!isEmailVerified) {
      onShowToast('Please verify your email address first to save weekly reports in Firestore.');
      return;
    }
    setIsSavingReport(true);
    try {
      const savedId = await onSaveWeeklyReport({
        id: `week-${liveSnapshot.endDateKey}`,
        startDateKey: liveSnapshot.startDateKey,
        endDateKey: liveSnapshot.endDateKey,
        loggedMealDaysCount: liveSnapshot.loggedMealDaysCount,
        totalMealsLogged: liveSnapshot.totalMealsLogged,
        dailyAverageTotals: liveSnapshot.dailyAverageTotals,
        weeklyTotals: liveSnapshot.weeklyTotals,
        dailyWaterGoalMl: liveSnapshot.dailyWaterGoalMl,
        averageWaterMl: liveSnapshot.averageWaterMl,
        totalWaterMl: liveSnapshot.totalWaterMl,
        dailyGoalsSnapshot: liveSnapshot.dailyGoalsSnapshot,
        days: liveSnapshot.days,
        aiSummary: activeAiFeedback.aiSummary,
        highlights: activeAiFeedback.highlights,
        suggestions: activeAiFeedback.suggestions,
        estimationDisclaimer: activeAiFeedback.estimationDisclaimer,
      });
      setViewingSavedId(savedId);
      onShowToast(`Saved weekly report (${liveSnapshot.startDateKey} to ${liveSnapshot.endDateKey})`);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Unable to save weekly report.');
    } finally {
      setIsSavingReport(false);
    }
  }

  async function handleDeleteSaved(reportId: string) {
    if (deletingReportId) return;
    setDeletingReportId(reportId);
    try {
      await onDeleteWeeklyReport(reportId);
      if (viewingSavedId === reportId) {
        setViewingSavedId(null);
      }
      onShowToast('Saved weekly report deleted');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Unable to delete saved report.');
    } finally {
      setDeletingReportId(null);
    }
  }

  // Metric goal & chart bounds
  const metricMeta = METRIC_OPTIONS.find((m) => m.id === activeMetric) || METRIC_OPTIONS[0];
  const metricGoalValue = useMemo(() => {
    switch (activeMetric) {
      case 'calories':
        return activeMetrics.dailyGoalsSnapshot.caloriesKcal;
      case 'protein':
        return activeMetrics.dailyGoalsSnapshot.proteinGrams;
      case 'carbs':
        return activeMetrics.dailyGoalsSnapshot.carbsGrams;
      case 'fat':
        return activeMetrics.dailyGoalsSnapshot.fatGrams;
      case 'fiber':
        return activeMetrics.dailyGoalsSnapshot.fiberGrams;
      case 'water':
        return activeMetrics.dailyWaterGoalMl;
    }
  }, [activeMetric, activeMetrics]);

  const chartMax = useMemo(() => {
    const dayValues = activeMetrics.days.map((d) => getMetricValueForDay(d, activeMetric));
    return Math.max(metricGoalValue, ...dayValues, 1);
  }, [activeMetrics.days, activeMetric, metricGoalValue]);

  const goalLineBottomPct = Math.min(100, Math.max(0, Math.round((metricGoalValue / chartMax) * 100)));

  const nextWeekEndKey = shiftLocalDateKey(selectedEndDateKey, 7);
  const canGoNextWeek = selectedEndDateKey < todayDateKey;

  // Goal comparison cards data
  const comparisonCards = [
    {
      label: 'Calories',
      unit: 'kcal',
      avgValue: activeMetrics.dailyAverageTotals.caloriesKcal,
      goalValue: activeMetrics.dailyGoalsSnapshot.caloriesKcal,
      hasData: activeMetrics.loggedMealDaysCount > 0,
      emptyNote: 'No meals logged',
    },
    {
      label: 'Protein',
      unit: 'g',
      avgValue: activeMetrics.dailyAverageTotals.proteinGrams,
      goalValue: activeMetrics.dailyGoalsSnapshot.proteinGrams,
      hasData: activeMetrics.loggedMealDaysCount > 0,
      emptyNote: 'No meals logged',
    },
    {
      label: 'Carbs',
      unit: 'g',
      avgValue: activeMetrics.dailyAverageTotals.carbsGrams,
      goalValue: activeMetrics.dailyGoalsSnapshot.carbsGrams,
      hasData: activeMetrics.loggedMealDaysCount > 0,
      emptyNote: 'No meals logged',
    },
    {
      label: 'Fat',
      unit: 'g',
      avgValue: activeMetrics.dailyAverageTotals.fatGrams,
      goalValue: activeMetrics.dailyGoalsSnapshot.fatGrams,
      hasData: activeMetrics.loggedMealDaysCount > 0,
      emptyNote: 'No meals logged',
    },
    {
      label: 'Fiber',
      unit: 'g',
      avgValue: activeMetrics.dailyAverageTotals.fiberGrams,
      goalValue: activeMetrics.dailyGoalsSnapshot.fiberGrams,
      hasData: activeMetrics.loggedMealDaysCount > 0,
      emptyNote: 'No meals logged',
    },
    {
      label: 'Water',
      unit: 'ml',
      avgValue: activeMetrics.averageWaterMl,
      goalValue: activeMetrics.dailyWaterGoalMl,
      hasData: activeMetrics.loggedWaterDaysCount > 0,
      emptyNote: 'No water logged',
    },
  ];

  const isAlreadySavedCurrentWeek = Boolean(
    matchedSavedReport &&
      activeAiFeedback &&
      matchedSavedReport.aiSummary === activeAiFeedback.aiSummary
  );

  return (
    <section
      id="weekly-report"
      className="bg-[#FFF8F9] py-5 sm:py-6"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Compact Section Header + Week Selector */}
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#BE123C]">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              7-Day Nutrition &amp; Hydration Insights
            </div>
            <p className="mt-0.5 text-xs text-[#644A52]">
              Estimated averages &amp; trends vs. saved targets. Missing days are never fabricated.
            </p>
          </div>

          {/* Week Selector Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectWeekEndDate(shiftLocalDateKey(selectedEndDateKey, -7))}
              aria-label="Previous 7-day week"
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[#E5CFD4] bg-white px-3.5 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              Prev Week
            </button>

            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-xs font-medium text-[#241118]">
              <Calendar className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              <span className="sr-only">Select week ending date</span>
              <input
                type="date"
                value={selectedEndDateKey}
                max={todayDateKey}
                onChange={(e) => {
                  if (e.target.value) handleSelectWeekEndDate(e.target.value);
                }}
                className="bg-transparent font-mono text-xs text-[#241118] focus:outline-none"
              />
            </label>

            <button
              type="button"
              disabled={!canGoNextWeek}
              onClick={() =>
                handleSelectWeekEndDate(
                  nextWeekEndKey > todayDateKey ? todayDateKey : nextWeekEndKey
                )
              }
              aria-label="Next 7-day week"
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[#E5CFD4] bg-white px-3.5 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              Next Week
              <ChevronRight className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
            </button>

            {selectedEndDateKey !== todayDateKey && (
              <button
                type="button"
                onClick={() => handleSelectWeekEndDate(todayDateKey)}
                className="min-h-[44px] rounded-xl bg-[#BE123C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#9F1239] cursor-pointer"
              >
                Last 7 Days
              </button>
            )}
          </div>
        </div>

        {/* Active Window Summary Strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEDCE0] bg-white px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-display font-bold text-[#241118]">
              {formatRangeLabel(activeMetrics.startDateKey, activeMetrics.endDateKey)}
            </span>
            <span className="font-mono text-[#644A52] tabular-nums">
              {activeMetrics.loggedMealDaysCount}/7 meal days logged ({activeMetrics.totalMealsLogged}{' '}
              meals)
            </span>
            <span className="font-mono text-[#644A52] tabular-nums">
              Water: {(activeMetrics.totalWaterMl / 1000).toFixed(1)} L total (
              {activeMetrics.waterGoalMetDaysCount}/7 goal met)
            </span>
          </div>

          {isViewingSavedSnapshot && (
            <button
              type="button"
              onClick={() => setViewingSavedId(null)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3 py-1.5 text-xs font-semibold text-[#BE123C] hover:bg-[#FDF2F4] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Switch to Live Diary Data
            </button>
          )}
        </div>

        {/* Previous Saved Weekly Reports History */}
        {savedReports.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[#EEDCE0] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#241118]">
                <History className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                <span>Saved Weekly Reports ({savedReports.length})</span>
              </div>
              <span className="text-[11px] text-[#7E6069]">
                Select any saved week to revisit its AI summary &amp; snapshot
              </span>
            </div>

            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {savedReports.map((rep) => {
                const isSelected =
                  isViewingSavedSnapshot && matchedSavedReport?.id === rep.id;
                const isDeleting = deletingReportId === rep.id;
                return (
                  <div
                    key={rep.id}
                    className={`flex min-w-[235px] shrink-0 items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-[#BE123C] bg-[#FDF2F4]'
                        : 'border-[#EEDCE0] bg-[#FFF8F9] hover:border-[#D9BAC1]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSavedReport(rep)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className="truncate font-display text-xs font-bold text-[#241118]">
                        {formatRangeLabel(rep.startDateKey, rep.endDateKey)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#644A52] tabular-nums">
                        Avg ~{rep.dailyAverageTotals.caloriesKcal} kcal · {rep.loggedMealDaysCount}/7
                        d
                      </p>
                      <p className="font-mono text-[10px] text-[#7E6069] tabular-nums">
                        Water avg {rep.averageWaterMl} ml
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(deletingReportId)}
                      onClick={() => void handleDeleteSaved(rep.id)}
                      aria-label={`Delete saved weekly report for ${rep.startDateKey} to ${rep.endDateKey}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#EEDCE0] bg-white text-[#7E6069] hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-700" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily Averages vs Saved Targets Cards */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#241118]">
              Estimated Daily Averages vs. Saved Goals
            </h3>
            <span className="text-[11px] text-[#7E6069]">
              {activeMetrics.loggedMealDaysCount > 0
                ? `Nutrition averaged across ${activeMetrics.loggedMealDaysCount} logged meal ${
                    activeMetrics.loggedMealDaysCount === 1 ? 'day' : 'days'
                  } · Estimated values`
                : 'No meals logged in this 7-day window'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {comparisonCards.map((card) => {
              const pct =
                card.hasData && card.goalValue > 0
                  ? Math.round((card.avgValue / card.goalValue) * 100)
                  : 0;
              const barPct = Math.min(100, pct);
              const diff = Math.round((card.avgValue - card.goalValue) * 10) / 10;
              const isNearTarget = pct >= 85 && pct <= 115;

              return (
                <div
                  key={card.label}
                  className="flex flex-col justify-between rounded-2xl border border-[#EEDCE0] bg-white p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-[#644A52]">{card.label}</span>
                      {card.hasData && (
                        <span
                          className={`font-mono text-[10px] font-bold tabular-nums ${
                            isNearTarget ? 'text-emerald-700' : 'text-[#BE123C]'
                          }`}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>

                    {card.hasData ? (
                      <p className="mt-1.5 font-mono text-lg font-bold text-[#241118] tabular-nums">
                        {card.avgValue}
                        <span className="ml-1 text-xs font-normal text-[#644A52]">{card.unit}</span>
                      </p>
                    ) : (
                      <p className="mt-2 font-mono text-xs font-medium text-[#7E6069]">
                        {card.emptyNote}
                      </p>
                    )}

                    <p className="mt-0.5 font-mono text-[11px] text-[#7E6069] tabular-nums">
                      Goal: {card.goalValue} {card.unit}
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F6E9EC]">
                      {card.hasData && (
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isNearTarget ? 'bg-emerald-600' : 'bg-[#BE123C]'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      )}
                    </div>
                    {card.hasData && (
                      <p className="mt-1.5 font-mono text-[10px] text-[#644A52] tabular-nums">
                        {diff === 0
                          ? 'On target'
                          : diff > 0
                            ? `+${diff} ${card.unit} vs goal`
                            : `${Math.abs(diff)} ${card.unit} under goal`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7-Day Trend Chart + Water & Meal Breakdown */}
        <div className="mt-6 rounded-2xl border border-[#EEDCE0] bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-display text-base font-bold text-[#241118]">
                7-Day Nutrition &amp; Water Trend
              </h3>
              <p className="mt-0.5 font-mono text-xs text-[#644A52] tabular-nums">
                Target: {metricGoalValue.toLocaleString()} {metricMeta.unit}/day · Dashed line
                indicates saved daily target
              </p>
            </div>

            {/* Metric Switcher */}
            <div
              role="tablist"
              aria-label="Weekly trend metric"
              className="flex flex-wrap gap-1 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] p-1"
            >
              {METRIC_OPTIONS.map((opt) => {
                const selected = activeMetric === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveMetric(opt.id)}
                    className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#BE123C] text-white'
                        : 'text-[#644A52] hover:bg-white hover:text-[#241118]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7-Day Column Chart */}
          <div className="relative mt-6">
            {/* Target reference line over the bar container height (h-40) */}
            <div className="relative grid grid-cols-7 gap-2 sm:gap-4">
              {activeMetrics.days.map((day) => {
                const value = getMetricValueForDay(day, activeMetric);
                const isNutritionMissing = !metricMeta.isWater && day.mealCount === 0;
                const isWaterMissing = Boolean(metricMeta.isWater && day.waterMl === 0);
                const isUnlogged = isNutritionMissing || isWaterMissing;

                const heightPct =
                  !isUnlogged && value > 0
                    ? Math.max(8, Math.round((value / chartMax) * 100))
                    : 0;
                const metGoal = value >= metricGoalValue && value > 0;
                const { weekday, shortDate } = formatDayColumn(day.dateKey, todayDateKey);

                return (
                  <div
                    key={day.dateKey}
                    title={
                      isNutritionMissing
                        ? `${day.dateKey}: No meals logged`
                        : isWaterMissing
                          ? `${day.dateKey}: No water logged`
                          : `${day.dateKey}: ${value} ${metricMeta.unit} (${day.mealCount} meals, ${day.waterMl} ml water)`
                    }
                    className="flex flex-col items-center"
                  >
                    <span className="font-mono text-[11px] font-semibold text-[#241118] tabular-nums">
                      {isUnlogged
                        ? '—'
                        : metricMeta.isWater && value >= 1000
                          ? `${(value / 1000).toFixed(1)}L`
                          : value}
                    </span>

                    <div className="relative mt-2 flex h-32 w-full max-w-[42px] items-end justify-center overflow-hidden rounded-xl border border-[#F2DFE3] bg-[#FFF8F9]">
                      {/* Dashed Goal Reference Line */}
                      {goalLineBottomPct > 0 && goalLineBottomPct <= 98 && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-[#BE123C]/45"
                          style={{ bottom: `${goalLineBottomPct}%` }}
                        />
                      )}

                      {!isUnlogged && heightPct > 0 ? (
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            metricMeta.isWater
                              ? metGoal
                                ? 'bg-emerald-600'
                                : 'bg-rose-500'
                              : metGoal
                                ? 'bg-emerald-600'
                                : 'bg-[#BE123C]'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      ) : (
                        <span className="mb-2 text-[9px] font-medium text-[#9A7F87]">0</span>
                      )}
                    </div>

                    <span className="mt-2 text-xs font-semibold text-[#241118]">{weekday}</span>
                    <span className="font-mono text-[10px] text-[#7E6069] tabular-nums">
                      {shortDate}
                    </span>
                    <span className="mt-0.5 text-[10px] text-[#7E6069] tabular-nums">
                      {day.mealCount > 0 ? `${day.mealCount}m` : 'No meals'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Water History Summary inside the report */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] px-4 py-3 text-xs text-[#644A52]">
            <span className="inline-flex items-center gap-2 font-medium text-[#241118]">
              <Droplets className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              Water Tracker Summary:
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
              <span>
                Total: {(activeMetrics.totalWaterMl / 1000).toFixed(2).replace(/\.?0+$/, '')} L
              </span>
              <span>
                Avg (logged days):{' '}
                {activeMetrics.loggedWaterDaysCount > 0
                  ? `${activeMetrics.averageWaterMl.toLocaleString()} ml`
                  : 'No entries'}
              </span>
              <span>Goal met: {activeMetrics.waterGoalMetDaysCount}/7 days</span>
            </div>
          </div>
        </div>

        {/* AI Weekly Summary Panel or Insufficient Data Guard */}
        <div className="mt-6 rounded-2xl border border-[#EEDCE0] bg-white p-5 sm:p-6">
          {activeMetrics.loggedMealDaysCount < 2 ? (
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Info className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#241118]">
                    Not enough food diary data for an AI weekly summary yet
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#644A52]">
                    Only{' '}
                    <strong className="font-mono text-[#241118]">
                      {activeMetrics.loggedMealDaysCount} of 7
                    </strong>{' '}
                    days in this week have logged meals. To keep your report accurate and honest,
                    missing days are never filled automatically. Log meals on at least{' '}
                    <strong>2 days</strong> in this window to generate an AI Weekly Nutrition
                    Summary.
                  </p>
                </div>
              </div>

              <a
                href="#analyzer"
                className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[#BE123C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#9F1239]"
              >
                Scan &amp; Log a Meal
              </a>
            </div>
          ) : (
            <div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#BE123C]">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    AI Weekly Summary &amp; Suggestions
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-bold text-[#241118]">
                    Practical Feedback for Your Week
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => void handleGenerateAiSummary()}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#BE123C] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9F1239] disabled:opacity-55 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Analyzing Week...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        {activeAiFeedback ? 'Regenerate AI Report' : 'Generate AI Weekly Report'}
                      </>
                    )}
                  </button>

                  {activeAiFeedback && (
                    <button
                      type="button"
                      disabled={isSavingReport || isAlreadySavedCurrentWeek}
                      onClick={() => void handleSaveReport()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-4 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] disabled:opacity-60 cursor-pointer"
                    >
                      {isSavingReport ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-[#BE123C]" aria-hidden="true" />
                          Saving...
                        </>
                      ) : isAlreadySavedCurrentWeek ? (
                        <>
                          <BookmarkCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                          Saved to History
                        </>
                      ) : (
                        <>
                          <BookmarkCheck className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
                          Save Weekly Report
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {aiError && (
                <div
                  role="alert"
                  className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
                >
                  <span className="inline-flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                    {aiError}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleGenerateAiSummary()}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {activeAiFeedback ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-4">
                    <p className="text-sm leading-relaxed text-[#241118]">
                      {activeAiFeedback.aiSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {activeAiFeedback.highlights.length > 0 && (
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                        <h4 className="font-display text-xs font-bold uppercase tracking-wider text-emerald-900">
                          What Went Well
                        </h4>
                        <ul className="mt-2.5 space-y-2">
                          {activeAiFeedback.highlights.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-xs leading-relaxed text-[#241118]"
                            >
                              <CheckCircle2
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeAiFeedback.suggestions.length > 0 && (
                      <div className="rounded-xl border border-[#EEDCE0] bg-[#FFF8F9] p-4">
                        <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#BE123C]">
                          Practical Next-Week Ideas
                        </h4>
                        <ul className="mt-2.5 space-y-2">
                          {activeAiFeedback.suggestions.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-xs leading-relaxed text-[#241118]"
                            >
                              <Sparkles
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#BE123C]"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <p className="flex items-start gap-2 rounded-xl border border-[#F2DFE3] bg-[#FFFDFD] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#7E6069]">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#BE123C]" aria-hidden="true" />
                    <span>
                      <strong>Estimated Nutrition Note:</strong>{' '}
                      {activeAiFeedback.estimationDisclaimer}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-[#E5CFD4] bg-[#FFF8F9] px-5 py-6 text-center">
                  <p className="text-xs leading-relaxed text-[#644A52]">
                    You have <strong className="text-[#241118]">{activeMetrics.loggedMealDaysCount}</strong>{' '}
                    logged meal days in this week. Click{' '}
                    <strong className="text-[#BE123C]">Generate AI Weekly Report</strong> to get a
                    short, supportive summary of your averages, water intake, and practical meal
                    adjustments.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
