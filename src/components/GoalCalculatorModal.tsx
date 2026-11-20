import { useMemo, useState } from 'react';
import { Calculator, Check, X } from 'lucide-react';
import type { DailyNutritionGoals } from '../types/nutrition';

interface GoalCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGoals: (goals: DailyNutritionGoals) => void;
}

type Sex = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
type GoalObjective = 'lose' | 'maintain' | 'gain';
type MacroStyle = 'balanced' | 'high-protein' | 'vegetarian';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, { label: string; factor: number }> = {
  sedentary: { label: 'Sedentary (Desk job, minimal exercise)', factor: 1.2 },
  light: { label: 'Lightly Active (1–3 workouts/week)', factor: 1.375 },
  moderate: { label: 'Moderately Active (3–5 workouts/week)', factor: 1.55 },
  active: { label: 'Very Active (6–7 workouts/week)', factor: 1.725 },
};

export function GoalCalculatorModal({
  isOpen,
  onClose,
  onApplyGoals,
}: GoalCalculatorModalProps) {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState(26);
  const [weightKg, setWeightKg] = useState(70);
  const [heightCm, setHeightCm] = useState(172);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [objective, setObjective] = useState<GoalObjective>('maintain');
  const [macroStyle, setMacroStyle] = useState<MacroStyle>('balanced');

  const computedGoals = useMemo<DailyNutritionGoals>(() => {
    const safeAge = Math.max(14, Math.min(95, Number(age) || 26));
    const safeWeight = Math.max(30, Math.min(250, Number(weightKg) || 70));
    const safeHeight = Math.max(120, Math.min(230, Number(heightCm) || 170));

    // Mifflin-St Jeor equation
    const bmr =
      sex === 'male'
        ? 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + 5
        : 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge - 161;

    const tdee = bmr * ACTIVITY_MULTIPLIERS[activity].factor;
    const calorieDelta = objective === 'lose' ? -450 : objective === 'gain' ? 350 : 0;
    const caloriesKcal = Math.max(1200, Math.round((tdee + calorieDelta) / 10) * 10);

    // Macro splits
    const split =
      macroStyle === 'high-protein'
        ? { p: 0.32, c: 0.4, f: 0.28 }
        : macroStyle === 'vegetarian'
          ? { p: 0.22, c: 0.5, f: 0.28 }
          : { p: 0.25, c: 0.47, f: 0.28 };

    const proteinGrams = Math.round((caloriesKcal * split.p) / 4);
    const carbsGrams = Math.round((caloriesKcal * split.c) / 4);
    const fatGrams = Math.round((caloriesKcal * split.f) / 9);
    const fiberGrams = Math.max(25, Math.round((caloriesKcal / 1000) * 14));

    return {
      caloriesKcal,
      proteinGrams,
      carbsGrams,
      fatGrams,
      fiberGrams,
    };
  }, [sex, age, weightKg, heightCm, activity, objective, macroStyle]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#241118]/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-calc-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#EEDCE0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EEDCE0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-5 w-5 text-[#BE123C]" aria-hidden="true" />
            <h2 id="goal-calc-title" className="font-display text-base font-bold text-[#241118]">
              Personal Daily Calorie &amp; Macro Calculator
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#644A52] hover:bg-[#FDF3F5] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <span className="block text-xs font-medium text-[#644A52]">Sex</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-[#FDF3F5] p-1">
                {(['male', 'female'] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSex(val)}
                    className={`rounded-md py-1.5 text-xs font-medium capitalize cursor-pointer ${
                      sex === val ? 'bg-white text-[#241118] shadow-xs' : 'text-[#644A52]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Age (yrs)</span>
              <input
                type="number"
                min={14}
                max={95}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-[#E5CFD4] px-3 py-2 font-mono text-sm text-[#241118] tabular-nums focus:border-[#BE123C] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Weight (kg)</span>
              <input
                type="number"
                min={30}
                max={250}
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-[#E5CFD4] px-3 py-2 font-mono text-sm text-[#241118] tabular-nums focus:border-[#BE123C] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[#644A52]">Height (cm)</span>
              <input
                type="number"
                min={120}
                max={230}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-[#E5CFD4] px-3 py-2 font-mono text-sm text-[#241118] tabular-nums focus:border-[#BE123C] focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-[#644A52]">Weekly Activity Level</span>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
              className="mt-1.5 w-full rounded-lg border border-[#E5CFD4] bg-white px-3 py-2.5 text-sm text-[#241118] focus:border-[#BE123C] focus:outline-none"
            >
              {(Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[]).map((key) => (
                <option key={key} value={key}>
                  {ACTIVITY_MULTIPLIERS[key].label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-[#644A52]">Goal</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-[#FDF3F5] p-1">
                {(
                  [
                    { id: 'lose', label: 'Fat Loss' },
                    { id: 'maintain', label: 'Maintain' },
                    { id: 'gain', label: 'Muscle Gain' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setObjective(item.id)}
                    className={`rounded-md px-2 py-2 text-xs font-medium cursor-pointer ${
                      objective === item.id
                        ? 'bg-white text-[#241118] shadow-xs'
                        : 'text-[#644A52]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#644A52]">Macro Preference</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-[#FDF3F5] p-1">
                {(
                  [
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'high-protein', label: 'High Protein' },
                    { id: 'vegetarian', label: 'Veg Focus' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMacroStyle(item.id)}
                    className={`rounded-md px-2 py-2 text-xs font-medium cursor-pointer ${
                      macroStyle === item.id
                        ? 'bg-white text-[#241118] shadow-xs'
                        : 'text-[#644A52]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculated Daily Preview */}
          <div className="rounded-xl border border-[#BE123C]/25 bg-[#FDF2F4] p-4">
            <p className="text-xs font-medium text-[#BE123C]">
              Recommended Daily Target (Mifflin-St Jeor Estimate)
            </p>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center font-mono tabular-nums">
              <div>
                <p className="text-lg font-bold text-[#241118]">{computedGoals.caloriesKcal}</p>
                <p className="text-[11px] text-[#644A52]">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#241118]">{computedGoals.proteinGrams}g</p>
                <p className="text-[11px] text-[#644A52]">Protein</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#241118]">{computedGoals.carbsGrams}g</p>
                <p className="text-[11px] text-[#644A52]">Carbs</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#241118]">{computedGoals.fatGrams}g</p>
                <p className="text-[11px] text-[#644A52]">Fat</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#241118]">{computedGoals.fiberGrams}g</p>
                <p className="text-[11px] text-[#644A52]">Fiber</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#EEDCE0] bg-[#FFF8F9] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium text-[#644A52] hover:bg-[#F9EBEE] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApplyGoals(computedGoals);
              onClose();
            }}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#BE123C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9F1239] cursor-pointer"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Apply to My Diary
          </button>
        </div>
      </div>
    </div>
  );
}
