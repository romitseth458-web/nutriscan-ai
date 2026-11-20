import type { DailyNutritionGoals, MacroTotals } from '../types/nutrition';

interface NutritionChartsProps {
  totals: MacroTotals;
  dailyGoals: DailyNutritionGoals;
}

export function NutritionCharts({ totals, dailyGoals }: NutritionChartsProps) {
  const proteinKcal = totals.proteinGrams * 4;
  const carbsKcal = totals.carbsGrams * 4;
  const fatKcal = totals.fatGrams * 9;
  const macroKcalSum = Math.max(1, proteinKcal + carbsKcal + fatKcal);

  const segments = [
    {
      label: 'Protein',
      grams: totals.proteinGrams,
      kcal: Math.round(proteinKcal),
      pct: Math.round((proteinKcal / macroKcalSum) * 100),
      color: '#15803D',
    },
    {
      label: 'Carbohydrates',
      grams: totals.carbsGrams,
      kcal: Math.round(carbsKcal),
      pct: Math.round((carbsKcal / macroKcalSum) * 100),
      color: '#0D9488',
    },
    {
      label: 'Fat',
      grams: totals.fatGrams,
      kcal: Math.round(fatKcal),
      pct: Math.max(0, 100 - Math.round((proteinKcal / macroKcalSum) * 100) - Math.round((carbsKcal / macroKcalSum) * 100)),
      color: '#D97706',
    },
  ];

  // SVG Donut math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const targetBars = [
    {
      label: 'Calories',
      value: totals.caloriesKcal,
      goal: dailyGoals.caloriesKcal,
      unit: 'kcal',
      color: 'bg-[#15803D]',
    },
    {
      label: 'Protein',
      value: totals.proteinGrams,
      goal: dailyGoals.proteinGrams,
      unit: 'g',
      color: 'bg-[#16A34A]',
    },
    {
      label: 'Carbs',
      value: totals.carbsGrams,
      goal: dailyGoals.carbsGrams,
      unit: 'g',
      color: 'bg-[#0D9488]',
    },
    {
      label: 'Fat',
      value: totals.fatGrams,
      goal: dailyGoals.fatGrams,
      unit: 'g',
      color: 'bg-[#D97706]',
    },
    {
      label: 'Fiber',
      value: totals.fiberGrams,
      goal: dailyGoals.fiberGrams,
      unit: 'g',
      color: 'bg-[#4D7C0F]',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Donut Chart: Energy Share by Macronutrient */}
      <div className="rounded-2xl border border-[#E2E8E4] bg-white p-6 lg:col-span-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#0F1F16]">
              Calorie Energy Split
            </h3>
            <p className="mt-0.5 text-xs text-[#5B7063]">
              Share of estimated calories from protein, carbs, and fat
            </p>
          </div>
          <span className="font-mono text-xs text-[#475E50] tabular-nums">
            {totals.caloriesKcal} kcal
          </span>
        </div>

        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="Calorie distribution donut chart">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#EEF3EF"
                strokeWidth="20"
              />
              {segments.map((seg) => {
                const segLength = (seg.kcal / macroKcalSum) * circumference;
                const strokeDasharray = `${segLength} ${circumference}`;
                const strokeDashoffset = -cumulativeOffset;
                cumulativeOffset += segLength;
                return (
                  <circle
                    key={seg.label}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="20"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-2xl font-bold text-[#0F1F16] tabular-nums">
                {totals.caloriesKcal}
              </span>
              <span className="text-xs font-medium text-[#5B7063]">kcal est.</span>
            </div>
          </div>

          <div className="w-full flex-1 divide-y divide-[#EEF3EF]">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-xs"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-[#0F1F16]">{seg.label}</p>
                    <p className="text-xs text-[#5B7063] tabular-nums">{seg.grams} g</p>
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="text-sm font-semibold text-[#0F1F16]">{seg.pct}%</p>
                  <p className="text-xs text-[#5B7063]">{seg.kcal} kcal</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Horizontal Bars: Meal Contribution vs Daily Target */}
      <div className="rounded-2xl border border-[#E2E8E4] bg-white p-6 lg:col-span-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#0F1F16]">
              Share of Daily Targets
            </h3>
            <p className="mt-0.5 text-xs text-[#5B7063]">
              How this meal contributes to your configured daily nutrition goals
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {targetBars.map((bar) => {
            const pct = Math.min(100, Math.round((bar.value / Math.max(1, bar.goal)) * 100));
            return (
              <div key={bar.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-[#0F1F16]">{bar.label}</span>
                  <span className="font-mono text-[#475E50] tabular-nums">
                    {bar.value} / {bar.goal} {bar.unit} ({pct}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF3EF]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${bar.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
