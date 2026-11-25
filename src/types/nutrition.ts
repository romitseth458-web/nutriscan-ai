export type IdentificationStatus = 'identified' | 'needs_clarification' | 'not_food';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type NutritionDataSource = 'reference_db' | 'gemini_estimate' | 'unavailable';

export interface MacroTotals {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface DetectedFoodItem extends MacroTotals {
  name: string;
  hindiName?: string;
  regionalCuisine?: string;
  cookingMethod?: string;
  keyIngredients?: string[];
  oilGheeSugarNote?: string;
  nutritionSource?: NutritionDataSource;
  referenceFoodId?: string;
  confidence?: ConfidenceLevel;
  portionGrams: number;
  preparationNote: string;
}

export interface HealthierAlternative {
  title: string;
  reason: string;
  estimatedCalorieSavingsKcal: number;
}

export interface HighProteinOption {
  title: string;
  proteinBoostGrams: number;
  description: string;
}

export interface DietOption {
  title: string;
  description: string;
}

export interface DietSuggestions {
  summary: string;
  healthierAlternatives: HealthierAlternative[];
  highProteinOptions: HighProteinOption[];
  vegetarianOptions: DietOption[];
  nonVegetarianOptions: DietOption[];
}

export interface FoodAnalysisResult {
  identificationStatus: IdentificationStatus;
  confidence: ConfidenceLevel;
  clarificationQuestion: string;
  mealTitle: string;
  cuisineRegion?: string;
  requiresUserConfirmation?: boolean;
  estimatedServingSizeGrams: number;
  servingDescription: string;
  totals: MacroTotals;
  items: DetectedFoodItem[];
  dietSuggestions: DietSuggestions;
  estimationDisclaimer: string;
}

export interface TrackedMealEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD in local time
  loggedAtIso: string;
  mealCategory: MealCategory;
  imageThumbnailDataUrl: string;
  analysis: FoodAnalysisResult;
}

export interface DailyNutritionGoals {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export type DietActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export type DietFitnessGoal =
  | 'weight_loss'
  | 'weight_gain'
  | 'muscle_building'
  | 'maintenance';

export type DietaryPreference =
  | 'vegetarian'
  | 'non-vegetarian'
  | 'eggetarian'
  | 'vegan';

export type DietBiologicalSex = 'male' | 'female';

export interface UserDietProfile {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  sex?: DietBiologicalSex;
  activityLevel?: DietActivityLevel;
  fitnessGoal?: DietFitnessGoal;
  dietaryPreference?: DietaryPreference;
  dailyBudgetInr?: number;
}

// ==================== AI PERSONALIZED INDIAN MEAL PLANNER TYPES ====================

export type MealPlanSlotId =
  | 'breakfast'
  | 'mid_morning'
  | 'lunch'
  | 'evening_snack'
  | 'dinner';

export type MealPlanSlotLabel =
  | 'Breakfast'
  | 'Mid-Morning Snack'
  | 'Lunch'
  | 'Evening Snack'
  | 'Dinner';

export interface MealPlannerInput {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: DietBiologicalSex;
  fitnessGoal: DietFitnessGoal;
  activityLevel: DietActivityLevel;
  dietaryPreference: DietaryPreference;
  dailyBudgetInr: number;
}

export interface PlannedFoodItem extends MacroTotals {
  id: string;
  name: string;
  hindiName?: string;
  portionGrams: number;
  portionLabel: string;
  estimatedCostInr: number;
  preparationNote: string;
  nutritionSource: NutritionDataSource;
  referenceFoodId?: string;
}

export interface PlannedMeal {
  slotId: MealPlanSlotId;
  slotLabel: MealPlanSlotLabel;
  timingWindow: string;
  title: string;
  totals: MacroTotals;
  estimatedCostInr: number;
  items: PlannedFoodItem[];
  tip: string;
}

export interface IndianMealPlan {
  id: string;
  planName: string;
  input: MealPlannerInput;
  targetDailyCaloriesKcal: number;
  estimatedBmrKcal: number;
  estimatedTdeeKcal: number;
  safetyNote: string;
  hydrationTip: string;
  budgetSummary: string;
  totals: MacroTotals;
  estimatedTotalCostInr: number;
  meals: PlannedMeal[];
  estimationDisclaimer: string;
  updatedAtIso: string;
}

// ==================== DAILY WATER INTAKE TRACKER TYPES ====================

export type WaterGoalUnit = 'ml' | 'L';

export interface WaterLogEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD in local time
  loggedAtIso: string;
  amountMl: number;
}

