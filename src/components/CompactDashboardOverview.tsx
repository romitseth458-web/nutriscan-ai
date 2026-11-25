import {
  BarChart3,
  Camera,
  ChefHat,
  Droplets,
  LayoutGrid,
  PhoneCall,
  Plus,
  Utensils,
} from 'lucide-react';

export type DashboardTab =
  | 'overview'
  | 'scanner'
  | 'meal-planner'
  | 'food-diary'
  | 'water-tracker'
  | 'weekly-report';

interface CompactDashboardOverviewProps {
  firstName: string;
  todayDateKey: string;
  todayCalories: number;
  calorieGoal: number;
  todayProtein: number;
  proteinGoal: number;
  todayCarbs: number;
  todayFat: number;
  todayFiber: number;
  todayMealsCount: number;
  todayWaterMl: number;
  waterGoalMl: number;
  weeklyLoggedDays: number;
  savedPlansCount: number;
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onQuickScanMeal: () => void;
  onQuickAddWater250: () => void;
  isAddingQuickWater: boolean;
  onOpenVoiceAssistant: () => void;
}

const FEATURE_TABS: { id: DashboardTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'All Sections', icon: LayoutGrid },
  { id: 'scanner', label: 'Scanner', icon: Camera },
  { id: 'meal-planner', label: 'Meal Plan', icon: ChefHat },
  { id: 'food-diary', label: 'Food Diary', icon: Utensils },
  { id: 'water-tracker', label: 'Water', icon: Droplets },
  { id: 'weekly-report', label: 'Weekly Report', icon: BarChart3 },
];

export function CompactDashboardOverview({
  firstName,
  todayDateKey,
  todayCalories,
  calorieGoal,
  todayProtein,
  proteinGoal,
  todayCarbs,
  todayFat,
  todayFiber,
  todayMealsCount,
  todayWaterMl,
  waterGoalMl,
  weeklyLoggedDays,
  savedPlansCount,
  activeTab,
  onSelectTab,
  onQuickScanMeal,
  onQuickAddWater250,
  isAddingQuickWater,
  onOpenVoiceAssistant,
}: CompactDashboardOverviewProps) {
  const calPct = Math.min(100, Math.round((todayCalories / Math.max(1, calorieGoal)) * 100));
  const calRemaining = Math.max(0, calorieGoal - todayCalories);
  const waterPct = Math.min(100, Math.round((todayWaterMl / Math.max(1, waterGoalMl)) * 100));
  const waterRemaining = Math.max(0, waterGoalMl - todayWaterMl);
  const proteinPct = Math.min(100, Math.round((todayProtein / Math.max(1, proteinGoal)) * 100));

  return (
    <section
      aria-label="Today's nutrition overview"
      className="border-b border-[#EEDCE0] bg-[#FFF8F9]"
    >
      <div className="mx-auto max-w-6xl px-3 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 lg:px-8">
        {/* Compact Header + Essential Quick Actions */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#644A52]">
              <span className="font-semibold text-[#BE123C]">Today</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{todayDateKey}</span>
            </div>
            <h1 className="mt-0.5 truncate font-display text-lg font-bold tracking-tight text-[#241118] sm:text-xl">
              Welcome back, {firstName}
            </h1>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={onQuickScanMeal}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-[#BE123C] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9F1239] whitespace-nowrap cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Scan Meal
            </button>

            <button
              type="button"
              disabled={isAddingQuickWater}
              onClick={onQuickAddWater250}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl border border-[#BE123C]/30 bg-white px-3 py-2 font-mono text-xs font-semibold text-[#BE123C] transition-colors hover:bg-[#FDF2F4] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              250ml Water
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('meal-planner')}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] whitespace-nowrap cursor-pointer"
            >
              <ChefHat className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
              Meal Plan
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('weekly-report')}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] whitespace-nowrap cursor-pointer"
            >
              <BarChart3 className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
              Weekly Report
            </button>

            <button
              type="button"
              onClick={onOpenVoiceAssistant}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E5CFD4] bg-white px-3 py-2 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] whitespace-nowrap cursor-pointer"
            >
              <PhoneCall className="h-3.5 w-3.5 text-[#BE123C]" aria-hidden="true" />
              AI Call
            </button>
          </div>
        </div>

        {/* 4 Compact Summary Cards */}
        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
          {/* Card 1: Today's Calories */}
          <button
            type="button"
            onClick={() => onSelectTab('food-diary')}
            className="flex flex-col justify-between rounded-xl border border-[#EEDCE0] bg-white p-3 text-left transition-colors hover:border-[#D9BAC1] cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-[#644A52]">Calories</span>
              <span className="font-mono text-[11px] font-bold text-[#BE123C] tabular-nums">
                {calPct}%
              </span>
            </div>
            <div className="mt-1 font-mono text-base font-bold text-[#241118] tabular-nums sm:text-lg">
              {todayCalories.toLocaleString()}
              <span className="ml-1 text-[11px] font-normal text-[#7E6069]">
                / {calorieGoal} kcal
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F6E9EC]">
              <div
                className="h-full rounded-full bg-[#BE123C] transition-all duration-300"
                style={{ width: `${calPct}%` }}
              />
            </div>
            <p className="mt-1.5 truncate font-mono text-[10px] text-[#7E6069] tabular-nums">
              {calRemaining > 0 ? `${calRemaining} kcal left` : 'Goal reached'}
            </p>
          </button>

          {/* Card 2: Today's Water */}
          <button
            type="button"
            onClick={() => onSelectTab('water-tracker')}
            className="flex flex-col justify-between rounded-xl border border-[#EEDCE0] bg-white p-3 text-left transition-colors hover:border-[#D9BAC1] cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-[#644A52]">Water Intake</span>
              <span
                className={`font-mono text-[11px] font-bold tabular-nums ${
                  todayWaterMl >= waterGoalMl ? 'text-emerald-700' : 'text-[#BE123C]'
                }`}
              >
                {waterPct}%
              </span>
            </div>
            <div className="mt-1 font-mono text-base font-bold text-[#241118] tabular-nums sm:text-lg">
              {todayWaterMl >= 1000
                ? `${(todayWaterMl / 1000).toFixed(2).replace(/\.?0+$/, '')} L`
                : `${todayWaterMl} ml`}
              <span className="ml-1 text-[11px] font-normal text-[#7E6069]">
                / {(waterGoalMl / 1000).toFixed(1).replace(/\.0$/, '')} L
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F6E9EC]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  todayWaterMl >= waterGoalMl ? 'bg-emerald-600' : 'bg-[#BE123C]'
                }`}
                style={{ width: `${waterPct}%` }}
              />
            </div>
            <p className="mt-1.5 truncate font-mono text-[10px] text-[#7E6069] tabular-nums">
              {waterRemaining > 0 ? `${waterRemaining} ml left` : 'Goal reached'}
            </p>
          </button>

          {/* Card 3: Protein & Macros */}
          <button
            type="button"
            onClick={() => onSelectTab('food-diary')}
            className="flex flex-col justify-between rounded-xl border border-[#EEDCE0] bg-white p-3 text-left transition-colors hover:border-[#D9BAC1] cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-[#644A52]">Protein</span>
              <span className="font-mono text-[11px] font-bold text-[#BE123C] tabular-nums">
                {proteinPct}%
              </span>
            </div>
            <div className="mt-1 font-mono text-base font-bold text-[#241118] tabular-nums sm:text-lg">
              {todayProtein}g
              <span className="ml-1 text-[11px] font-normal text-[#7E6069]">
                / {proteinGoal}g
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F6E9EC]">
              <div
                className="h-full rounded-full bg-[#E11D48] transition-all duration-300"
                style={{ width: `${proteinPct}%` }}
              />
            </div>
            <p className="mt-1.5 truncate font-mono text-[10px] text-[#7E6069] tabular-nums">
              C {todayCarbs}g · F {todayFat}g · Fib {todayFiber}g
            </p>
          </button>

          {/* Card 4: Activity & Weekly Log */}
          <button
            type="button"
            onClick={() => onSelectTab('weekly-report')}
            className="flex flex-col justify-between rounded-xl border border-[#EEDCE0] bg-white p-3 text-left transition-colors hover:border-[#D9BAC1] cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-[#644A52]">Weekly Log</span>
              <span className="font-mono text-[11px] font-bold text-[#241118] tabular-nums">
                {weeklyLoggedDays}/7 d
              </span>
            </div>
            <div className="mt-1 font-mono text-base font-bold text-[#241118] tabular-nums sm:text-lg">
              {todayMealsCount} {todayMealsCount === 1 ? 'meal' : 'meals'}
              <span className="ml-1 text-[11px] font-normal text-[#7E6069]">today</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F6E9EC]">
              <div
                className="h-full rounded-full bg-[#0D9488] transition-all duration-300"
                style={{ width: `${Math.round((weeklyLoggedDays / 7) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 truncate font-mono text-[10px] text-[#7E6069] tabular-nums">
              {savedPlansCount} saved {savedPlansCount === 1 ? 'plan' : 'plans'} · Tap for report
            </p>
          </button>
        </div>

        {/* Compact Workspace Tab Bar */}
        <div
          role="tablist"
          aria-label="RosoFood AI workspaces"
          className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-[#EEDCE0] bg-white p-1"
        >
          {FEATURE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectTab(tab.id)}
                className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#BE123C] text-white'
                    : 'text-[#644A52] hover:bg-[#FFF8F9] hover:text-[#241118]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
