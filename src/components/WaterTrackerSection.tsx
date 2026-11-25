import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Droplets,
  GlassWater,
  Loader2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { WaterGoalUnit, WaterLogEntry } from '../types/nutrition';
import { getLocalDateKey } from '../utils/storage';

interface WaterTrackerSectionProps {
  entries: WaterLogEntry[];
  waterGoalMl: number;
  todayDateKey: string;
  isEmailVerified: boolean;
  onUpdateWaterGoal: (goalMl: number) => Promise<void>;
  onAddWater: (amountMl: number, dateKey: string) => Promise<void>;
  onDeleteWaterEntry: (entryId: string) => Promise<void>;
}

const QUICK_AMOUNTS_ML = [
  { amountMl: 250, label: '+250 ml', sublabel: '1 glass' },
  { amountMl: 500, label: '+500 ml', sublabel: 'Small bottle' },
  { amountMl: 750, label: '+750 ml', sublabel: 'Large bottle' },
] as const;

const GOAL_PRESETS_ML = [2000, 2500, 3000, 3500] as const;

function formatLitres(ml: number): string {
  return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L`;
}

function getLast7LocalDateKeys(anchorDateKey: string): string[] {
  const parts = anchorDateKey.split('-').map(Number);
  const anchor =
    parts.length === 3 && parts.every((n) => Number.isFinite(n))
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();

  const keys: string[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - offset);
    keys.push(getLocalDateKey(d));
  }
  return keys;
}

function formatShortDay(dateKey: string, todayKey: string): { weekday: string; dayLabel: string } {
  if (dateKey === todayKey) {
    return { weekday: 'Today', dayLabel: dateKey.slice(5) };
  }
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return {
    weekday: dt.toLocaleDateString([], { weekday: 'short' }),
    dayLabel: dateKey.slice(5),
  };
}

export function WaterTrackerSection({
  entries,
  waterGoalMl,
  todayDateKey,
  isEmailVerified,
  onUpdateWaterGoal,
  onAddWater,
  onDeleteWaterEntry,
}: WaterTrackerSectionProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayDateKey);
  const [displayUnit, setDisplayUnit] = useState<WaterGoalUnit>('ml');

  // Goal Editor state
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalUnit, setGoalUnit] = useState<WaterGoalUnit>('ml');
  const [goalValueInput, setGoalValueInput] = useState<string>(String(waterGoalMl));
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // Custom log state
  const [customAmountInput, setCustomAmountInput] = useState<string>('');
  const [customUnit, setCustomUnit] = useState<WaterGoalUnit>('ml');

  // Operation state
  const [isAddingMl, setIsAddingMl] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lastKnownToday, setLastKnownToday] = useState(todayDateKey);
  useEffect(() => {
    if (todayDateKey !== lastKnownToday) {
      if (selectedDateKey === lastKnownToday) {
        setSelectedDateKey(todayDateKey);
      }
      setLastKnownToday(todayDateKey);
    }
  }, [todayDateKey, lastKnownToday, selectedDateKey]);

  useEffect(() => {
    if (!isEditingGoal) {
      setGoalValueInput(
        goalUnit === 'L'
          ? String(Math.round((waterGoalMl / 1000) * 100) / 100)
          : String(waterGoalMl)
      );
    }
  }, [waterGoalMl, goalUnit, isEditingGoal]);

  // Group entries by dateKey strictly from user's real Firestore waterLogs
  const totalsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      map.set(entry.dateKey, (map.get(entry.dateKey) || 0) + entry.amountMl);
    }
    return map;
  }, [entries]);

  const todayTotalMl = totalsByDate.get(todayDateKey) || 0;
  const activeDayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.dateKey === selectedDateKey)
        .sort((a, b) => b.loggedAtIso.localeCompare(a.loggedAtIso)),
    [entries, selectedDateKey]
  );

  const selectedDayTotalMl = useMemo(
    () => activeDayEntries.reduce((sum, e) => sum + e.amountMl, 0),
    [activeDayEntries]
  );

  const todayPercentRaw = Math.round((todayTotalMl / Math.max(1, waterGoalMl)) * 100);
  const todayPercentClamped = Math.min(100, todayPercentRaw);
  const todayRemainingMl = Math.max(0, waterGoalMl - todayTotalMl);
  const todaySurplusMl = Math.max(0, todayTotalMl - waterGoalMl);

  // Weekly 7-day history strictly derived from real logged water entries
  const weeklyHistory = useMemo(() => {
    const keys = getLast7LocalDateKeys(todayDateKey);
    const days = keys.map((dateKey) => {
      const totalMl = totalsByDate.get(dateKey) || 0;
      const pct = Math.min(100, Math.round((totalMl / Math.max(1, waterGoalMl)) * 100));
      return {
        dateKey,
        totalMl,
        pct,
        goalMet: totalMl >= waterGoalMl,
        ...formatShortDay(dateKey, todayDateKey),
      };
    });
    const weeklyTotalMl = days.reduce((sum, d) => sum + d.totalMl, 0);
    const weeklyAvgMl = Math.round(weeklyTotalMl / 7);
    const daysGoalMet = days.filter((d) => d.goalMet).length;
    const chartMaxMl = Math.max(waterGoalMl, ...days.map((d) => d.totalMl));
    return { days, weeklyTotalMl, weeklyAvgMl, daysGoalMet, chartMaxMl };
  }, [totalsByDate, todayDateKey, waterGoalMl]);

  async function handleQuickAdd(amountMl: number) {
    if (isAddingMl !== null) return;
    setErrorMsg(null);
    setIsAddingMl(amountMl);
    try {
      await onAddWater(amountMl, selectedDateKey);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save water entry.');
    } finally {
      setIsAddingMl(null);
    }
  }

  async function handleCustomAdd(e: React.FormEvent) {
    e.preventDefault();
    const rawNum = Number(customAmountInput);
    if (!Number.isFinite(rawNum) || rawNum <= 0) {
      setErrorMsg('Please enter a valid positive water amount.');
      return;
    }
    const mlValue = customUnit === 'L' ? Math.round(rawNum * 1000) : Math.round(rawNum);
    if (mlValue < 10 || mlValue > 5000) {
      setErrorMsg('Please enter a single entry between 10 ml and 5,000 ml (5 L).');
      return;
    }
    setCustomAmountInput('');
    await handleQuickAdd(mlValue);
  }

  async function handleUndoLast() {
    const latest = activeDayEntries[0];
    if (!latest || deletingId) return;
    setErrorMsg(null);
    setDeletingId(latest.id);
    try {
      await onDeleteWaterEntry(latest.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to undo last entry.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteSingle(entryId: string) {
    if (deletingId) return;
    setErrorMsg(null);
    setDeletingId(entryId);
    try {
      await onDeleteWaterEntry(entryId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete water entry.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(goalValueInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMsg('Please enter a valid daily water goal.');
      return;
    }
    const nextGoalMl = goalUnit === 'L' ? Math.round(parsed * 1000) : Math.round(parsed);
    if (nextGoalMl < 500 || nextGoalMl > 10000) {
      setErrorMsg('Daily water goal must be between 500 ml (0.5 L) and 10,000 ml (10 L).');
      return;
    }
    setErrorMsg(null);
    setIsSavingGoal(true);
    try {
      await onUpdateWaterGoal(nextGoalMl);
      setIsEditingGoal(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save water goal.');
    } finally {
      setIsSavingGoal(false);
    }
  }

  function handleSwitchGoalEditorUnit(nextUnit: WaterGoalUnit) {
    if (nextUnit === goalUnit) return;
    const currentNum = Number(goalValueInput);
    if (Number.isFinite(currentNum) && currentNum > 0) {
      if (nextUnit === 'L') {
        setGoalValueInput(String(Math.round((currentNum / 1000) * 100) / 100));
      } else {
        setGoalValueInput(String(Math.round(currentNum * 1000)));
      }
    }
    setGoalUnit(nextUnit);
  }

  function formatAmount(ml: number): string {
    return displayUnit === 'L' ? formatLitres(ml) : `${ml.toLocaleString()} ml`;
  }

  // SVG Ring geometry
  const ringRadius = 62;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - todayPercentClamped / 100);

  return (
    <section
      id="water-tracker"
      className="border-t border-[#EEDCE0] bg-white py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#BE123C]">
              <Droplets className="h-4 w-4" aria-hidden="true" />
              Daily Hydration Tracker
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#241118] sm:text-3xl">
              Daily Water Intake Tracker
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#644A52]">
              Track your water intake in ml or litres, reset automatically each local morning, and
              review your daily and 7-day hydration consistency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Display unit switcher */}
            <div
              role="group"
              aria-label="Water display unit"
              className="inline-flex rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] p-1"
            >
              {(['ml', 'L'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setDisplayUnit(unit)}
                  className={`min-h-[36px] rounded-lg px-3 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    displayUnit === unit
                      ? 'bg-[#BE123C] text-white'
                      : 'text-[#644A52] hover:text-[#241118]'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setGoalUnit(displayUnit);
                setGoalValueInput(
                  displayUnit === 'L'
                    ? String(Math.round((waterGoalMl / 1000) * 100) / 100)
                    : String(waterGoalMl)
                );
                setIsEditingGoal((prev) => !prev);
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5CFD4] bg-[#FFF8F9] px-4 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
              {isEditingGoal ? 'Close Goal Editor' : `Goal: ${formatAmount(waterGoalMl)}`}
            </button>
          </div>
        </div>

        {/* Unverified email hint */}
        {!isEmailVerified && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              Verify your email address first so your daily water intake logs and custom hydration
              goal save privately in Firebase Firestore.
            </span>
          </div>
        )}

        {/* Inline Goal Setter (ml or Litres) */}
        {isEditingGoal && (
          <form
            onSubmit={handleSaveGoal}
            className="mt-5 rounded-2xl border border-[#E5CFD4] bg-[#FFF8F9] p-5"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-display text-sm font-bold text-[#241118]">
                  Set Daily Water Intake Goal
                </h3>
                <p className="mt-0.5 text-xs text-[#644A52]">
                  Enter your daily target in milliliters (ml) or litres (L), between 500 ml and 10 L.
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-[#E5CFD4] bg-white p-1 self-start">
                {(['ml', 'L'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => handleSwitchGoalEditorUnit(unit)}
                    className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold cursor-pointer ${
                      goalUnit === unit
                        ? 'bg-[#241118] text-white'
                        : 'text-[#644A52] hover:text-[#241118]'
                    }`}
                  >
                    {unit === 'L' ? 'Litres (L)' : 'Milliliters (ml)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={goalUnit === 'L' ? '0.1' : '50'}
                  min={goalUnit === 'L' ? 0.5 : 500}
                  max={goalUnit === 'L' ? 10 : 10000}
                  value={goalValueInput}
                  onChange={(e) => setGoalValueInput(e.target.value)}
                  aria-label="Daily water goal value"
                  className="min-h-[44px] w-32 rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 font-mono text-sm font-bold text-[#241118] focus:border-[#BE123C] focus:outline-none"
                />
                <span className="font-mono text-sm font-semibold text-[#644A52]">{goalUnit}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {GOAL_PRESETS_ML.map((presetMl) => (
                  <button
                    key={presetMl}
                    type="button"
                    onClick={() =>
                      setGoalValueInput(
                        goalUnit === 'L' ? String(presetMl / 1000) : String(presetMl)
                      )
                    }
                    className="min-h-[40px] rounded-xl border border-[#EEDCE0] bg-white px-3 font-mono text-xs font-semibold text-[#644A52] hover:border-[#BE123C] hover:text-[#BE123C] cursor-pointer"
                  >
                    {goalUnit === 'L' ? `${presetMl / 1000} L` : `${presetMl} ml`}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSavingGoal}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#BE123C] px-5 py-2 text-xs font-semibold text-white hover:bg-[#9F1239] disabled:opacity-50 sm:ml-auto cursor-pointer"
              >
                {isSavingGoal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Save Goal
              </button>
            </div>
          </form>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Progress + Quick Actions Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Today's Hydration Ring & Progress Card */}
          <div className="rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-5 sm:p-6 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#BE123C]">
                Today&apos;s Progress ({todayDateKey})
              </span>
              <span className="font-mono text-xs text-[#644A52] tabular-nums">
                Goal {formatAmount(waterGoalMl)}
              </span>
            </div>

            <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
              {/* Visual Progress Ring */}
              <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
                <svg className="h-40 w-40 -rotate-90" viewBox="0 0 150 150" aria-hidden="true">
                  <circle
                    cx="75"
                    cy="75"
                    r={ringRadius}
                    fill="none"
                    stroke="#F6E9EC"
                    strokeWidth="12"
                  />
                  <circle
                    cx="75"
                    cy="75"
                    r={ringRadius}
                    fill="none"
                    stroke={todayTotalMl >= waterGoalMl ? '#059669' : '#BE123C'}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringDashOffset}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono text-2xl font-bold text-[#241118] tabular-nums">
                    {todayPercentRaw}%
                  </span>
                  <span className="mt-0.5 font-mono text-xs font-medium text-[#644A52] tabular-nums">
                    {formatAmount(todayTotalMl)}
                  </span>
                </div>
              </div>

              {/* Totals & Remaining Summary */}
              <div className="w-full min-w-0 flex-1 space-y-3">
                <div className="rounded-xl border border-[#EEDCE0] bg-white p-3.5">
                  <p className="text-[11px] font-medium text-[#7E6069]">Today&apos;s Water Intake</p>
                  <p className="mt-0.5 font-mono text-xl font-bold text-[#241118] tabular-nums">
                    {todayTotalMl.toLocaleString()} ml{' '}
                    <span className="text-xs font-normal text-[#644A52]">
                      ({formatLitres(todayTotalMl)})
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-[#EEDCE0] bg-white p-3.5">
                  <p className="text-[11px] font-medium text-[#7E6069]">Remaining Today</p>
                  {todayRemainingMl > 0 ? (
                    <p className="mt-0.5 font-mono text-lg font-bold text-[#BE123C] tabular-nums">
                      {todayRemainingMl.toLocaleString()} ml{' '}
                      <span className="text-xs font-normal text-[#644A52]">
                        ({formatLitres(todayRemainingMl)})
                      </span>
                    </p>
                  ) : (
                    <p className="mt-0.5 font-mono text-sm font-bold text-emerald-700 tabular-nums">
                      Daily goal reached!
                      {todaySurplusMl > 0 ? ` (+${todaySurplusMl.toLocaleString()} ml)` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Linear Progress Bar */}
            <div className="mt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F6E9EC]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    todayTotalMl >= waterGoalMl ? 'bg-emerald-600' : 'bg-[#BE123C]'
                  }`}
                  style={{ width: `${todayPercentClamped}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-[#7E6069]">
                Daily progress resets automatically at local midnight without removing past history.
              </p>
            </div>
          </div>

          {/* Quick Add & Daily Log Controls */}
          <div className="flex flex-col justify-between gap-5 rounded-2xl border border-[#EEDCE0] bg-[#FFF8F9] p-5 sm:p-6 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-[#241118]">
                    Quick Add Water ({selectedDateKey === todayDateKey ? 'Today' : selectedDateKey})
                  </h3>
                  <p className="mt-0.5 text-xs text-[#644A52]">
                    Tap a serving size to save instantly to your private hydration log.
                  </p>
                </div>

                {activeDayEntries.length > 0 && (
                  <button
                    type="button"
                    disabled={Boolean(deletingId)}
                    onClick={() => void handleUndoLast()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5CFD4] bg-white px-3.5 py-2 text-xs font-semibold text-[#241118] hover:bg-[#FDF2F4] disabled:opacity-50 cursor-pointer"
                  >
                    {deletingId === activeDayEntries[0]?.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#BE123C]" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
                    )}
                    Undo Last ({activeDayEntries[0].amountMl} ml)
                  </button>
                )}
              </div>

              {/* +250 ml, +500 ml, +750 ml Quick Buttons */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {QUICK_AMOUNTS_ML.map((preset) => {
                  const busy = isAddingMl === preset.amountMl;
                  return (
                    <button
                      key={preset.amountMl}
                      type="button"
                      disabled={isAddingMl !== null}
                      onClick={() => void handleQuickAdd(preset.amountMl)}
                      className="flex min-h-[64px] items-center justify-between rounded-xl border border-[#BE123C]/25 bg-white px-4 py-3 text-left transition-all hover:border-[#BE123C] hover:bg-[#FDF2F4] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                    >
                      <div>
                        <p className="font-mono text-base font-bold text-[#BE123C] tabular-nums">
                          {preset.label}
                        </p>
                        <p className="text-[11px] text-[#644A52]">{preset.sublabel}</p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#BE123C] text-white">
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <GlassWater className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount Input */}
              <form
                onSubmit={handleCustomAdd}
                className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#EEDCE0] bg-white p-3"
              >
                <label className="sr-only" htmlFor="custom-water-amount">
                  Custom water amount
                </label>
                <input
                  id="custom-water-amount"
                  type="number"
                  step={customUnit === 'L' ? '0.1' : '10'}
                  min={customUnit === 'L' ? 0.05 : 10}
                  max={customUnit === 'L' ? 5 : 5000}
                  placeholder={customUnit === 'L' ? 'Custom e.g. 0.4 L' : 'Custom e.g. 350 ml'}
                  value={customAmountInput}
                  onChange={(e) => setCustomAmountInput(e.target.value)}
                  className="min-h-[42px] min-w-[140px] flex-1 rounded-lg border border-[#E5CFD4] px-3 py-1.5 font-mono text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
                />
                <select
                  aria-label="Custom water unit"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as WaterGoalUnit)}
                  className="min-h-[42px] rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-2.5 text-xs font-semibold text-[#241118] focus:border-[#BE123C] focus:outline-none"
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                </select>
                <button
                  type="submit"
                  disabled={isAddingMl !== null || !customAmountInput.trim()}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#241118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A1E28] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add Water
                </button>
              </form>
            </div>

            {/* 7-Day Weekly Summary Strip */}
            <div className="rounded-xl border border-[#EEDCE0] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#241118]">
                  Weekly Hydration History (Last 7 Days)
                </p>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#644A52] tabular-nums">
                  <span>Avg: {formatAmount(weeklyHistory.weeklyAvgMl)}/day</span>
                  <span>·</span>
                  <span>Goals met: {weeklyHistory.daysGoalMet}/7</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2">
                {weeklyHistory.days.map((day) => {
                  const barHeightPct =
                    day.totalMl > 0
                      ? Math.max(8, Math.round((day.totalMl / weeklyHistory.chartMaxMl) * 100))
                      : 0;
                  const isSelected = selectedDateKey === day.dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(day.dateKey)}
                      title={`${day.dateKey}: ${day.totalMl} ml (${day.pct}%)`}
                      className={`flex flex-col items-center rounded-xl border p-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#BE123C] bg-[#FDF2F4]'
                          : 'border-transparent hover:border-[#EEDCE0] hover:bg-[#FFF8F9]'
                      }`}
                    >
                      <span className="font-mono text-[10px] font-semibold text-[#644A52] tabular-nums">
                        {day.totalMl >= 1000
                          ? `${(day.totalMl / 1000).toFixed(1)}L`
                          : day.totalMl > 0
                            ? `${day.totalMl}`
                            : '0'}
                      </span>
                      <div className="mt-1.5 flex h-20 w-4 items-end overflow-hidden rounded-full bg-[#F6E9EC] sm:w-5">
                        {barHeightPct > 0 && (
                          <div
                            className={`w-full rounded-full transition-all duration-300 ${
                              day.goalMet ? 'bg-emerald-600' : 'bg-[#BE123C]'
                            }`}
                            style={{ height: `${barHeightPct}%` }}
                          />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[11px] font-semibold ${
                          isSelected ? 'text-[#BE123C]' : 'text-[#241118]'
                        }`}
                      >
                        {day.weekday}
                      </span>
                      <span className="font-mono text-[9px] text-[#7E6069]">{day.dayLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Entries History Card */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEDCE0] px-5 py-4 sm:px-6">
            <div>
              <h3 className="font-display text-sm font-bold text-[#241118]">
                Daily Hydration Entries ({activeDayEntries.length})
              </h3>
              <p className="mt-0.5 font-mono text-xs text-[#644A52] tabular-nums">
                {selectedDateKey}: {selectedDayTotalMl.toLocaleString()} ml (
                {formatLitres(selectedDayTotalMl)}) logged
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedDateKey !== todayDateKey && (
                <button
                  type="button"
                  onClick={() => setSelectedDateKey(todayDateKey)}
                  className="min-h-[38px] rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3 text-xs font-semibold text-[#BE123C] hover:bg-[#FDF2F4] cursor-pointer"
                >
                  Back to Today
                </button>
              )}
              <label className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#E5CFD4] bg-white px-3 py-1.5 text-xs font-medium text-[#241118]">
                <Calendar className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
                <span className="sr-only">Select hydration date</span>
                <input
                  type="date"
                  value={selectedDateKey}
                  max={todayDateKey}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDateKey(e.target.value);
                  }}
                  className="bg-transparent font-mono text-xs text-[#241118] focus:outline-none"
                />
              </label>
            </div>
          </div>

          {activeDayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDF2F4] text-[#BE123C]">
                <Droplets className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 font-display text-sm font-semibold text-[#241118]">
                No water logged for {selectedDateKey}
              </p>
              <p className="mt-1 max-w-sm text-xs text-[#7E6069]">
                Use the +250 ml, +500 ml, or +750 ml quick buttons above to record real hydration
                entries.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F6E9EC]">
              {activeDayEntries.map((entry) => {
                const timeFormatted = new Date(entry.loggedAtIso).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isDeletingThis = deletingId === entry.id;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[#FFF8F9] sm:px-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FDF2F4] text-[#BE123C]">
                        <GlassWater className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-mono text-sm font-bold text-[#241118] tabular-nums">
                          +{entry.amountMl.toLocaleString()} ml{' '}
                          <span className="text-xs font-normal text-[#644A52]">
                            ({formatLitres(entry.amountMl)})
                          </span>
                        </p>
                        <p className="text-xs text-[#7E6069] tabular-nums">Logged at {timeFormatted}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(deletingId)}
                      onClick={() => void handleDeleteSingle(entry.id)}
                      aria-label={`Delete ${entry.amountMl} ml water entry from ${timeFormatted}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#EEDCE0] bg-white text-[#7E6069] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin text-red-700" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
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
