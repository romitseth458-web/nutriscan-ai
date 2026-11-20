export type IdentificationStatus = 'identified' | 'needs_clarification' | 'not_food';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface MacroTotals {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface DetectedFoodItem extends MacroTotals {
  name: string;
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
