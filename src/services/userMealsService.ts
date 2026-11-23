import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  DailyNutritionGoals,
  DietaryPreference,
  DietActivityLevel,
  DietFitnessGoal,
  FoodAnalysisResult,
  MealCategory,
  TrackedMealEntry,
  UserDietProfile,
} from '../types/nutrition';
import { DEFAULT_DAILY_GOALS } from '../utils/storage';

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  dailyGoals: DailyNutritionGoals;
  dietProfile?: UserDietProfile;
}

const VALID_CATEGORIES = new Set<MealCategory>(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
const MAX_THUMBNAIL_CHARS = 80_000;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, num));
}

export function sanitizeDailyGoals(goals: Partial<DailyNutritionGoals>): DailyNutritionGoals {
  return {
    caloriesKcal: Math.round(
      clampNumber(goals.caloriesKcal, 400, 15000, DEFAULT_DAILY_GOALS.caloriesKcal)
    ),
    proteinGrams: Math.round(
      clampNumber(goals.proteinGrams, 1, 1000, DEFAULT_DAILY_GOALS.proteinGrams)
    ),
    carbsGrams: Math.round(
      clampNumber(goals.carbsGrams, 1, 2000, DEFAULT_DAILY_GOALS.carbsGrams)
    ),
    fatGrams: Math.round(clampNumber(goals.fatGrams, 1, 1000, DEFAULT_DAILY_GOALS.fatGrams)),
    fiberGrams: Math.round(
      clampNumber(goals.fiberGrams, 1, 500, DEFAULT_DAILY_GOALS.fiberGrams)
    ),
  };
}

const VALID_ACTIVITY_LEVELS = new Set<DietActivityLevel>([
  'sedentary',
  'light',
  'moderate',
  'active',
]);
const VALID_FITNESS_GOALS = new Set<DietFitnessGoal>([
  'weight_loss',
  'weight_gain',
  'muscle_building',
  'maintenance',
]);
const VALID_DIETARY_PREFERENCES = new Set<DietaryPreference>([
  'vegetarian',
  'non-vegetarian',
  'eggetarian',
  'vegan',
]);

export function sanitizeDietProfile(
  raw: Partial<UserDietProfile> | null | undefined
): UserDietProfile {
  if (!raw || typeof raw !== 'object') return {};
  const clean: UserDietProfile = {};

  if (typeof raw.age === 'number' && Number.isFinite(raw.age)) {
    clean.age = Math.round(Math.min(100, Math.max(13, raw.age)));
  }
  if (typeof raw.heightCm === 'number' && Number.isFinite(raw.heightCm)) {
    clean.heightCm = Math.round(Math.min(250, Math.max(100, raw.heightCm)) * 10) / 10;
  }
  if (typeof raw.weightKg === 'number' && Number.isFinite(raw.weightKg)) {
    clean.weightKg = Math.round(Math.min(300, Math.max(25, raw.weightKg)) * 10) / 10;
  }
  if (raw.sex === 'male' || raw.sex === 'female') {
    clean.sex = raw.sex;
  }
  if (
    typeof raw.activityLevel === 'string' &&
    VALID_ACTIVITY_LEVELS.has(raw.activityLevel as DietActivityLevel)
  ) {
    clean.activityLevel = raw.activityLevel as DietActivityLevel;
  }
  if (
    typeof raw.fitnessGoal === 'string' &&
    VALID_FITNESS_GOALS.has(raw.fitnessGoal as DietFitnessGoal)
  ) {
    clean.fitnessGoal = raw.fitnessGoal as DietFitnessGoal;
  }
  if (
    typeof raw.dietaryPreference === 'string' &&
    VALID_DIETARY_PREFERENCES.has(raw.dietaryPreference as DietaryPreference)
  ) {
    clean.dietaryPreference = raw.dietaryPreference as DietaryPreference;
  }
  if (typeof raw.dailyBudgetInr === 'number' && Number.isFinite(raw.dailyBudgetInr)) {
    clean.dailyBudgetInr = Math.round(Math.min(5000, Math.max(50, raw.dailyBudgetInr)));
  }

  return clean;
}

function sanitizeAnalysisForFirestore(analysis: FoodAnalysisResult): FoodAnalysisResult {
  const items = Array.isArray(analysis.items)
    ? analysis.items.slice(0, 30).map((item) => ({
        name: String(item.name || 'Food item').slice(0, 120),
        ...(typeof item.hindiName === 'string' && item.hindiName.trim()
          ? { hindiName: item.hindiName.trim().slice(0, 120) }
          : {}),
        ...(typeof item.regionalCuisine === 'string' && item.regionalCuisine.trim()
          ? { regionalCuisine: item.regionalCuisine.trim().slice(0, 80) }
          : {}),
        ...(typeof item.cookingMethod === 'string' && item.cookingMethod.trim()
          ? { cookingMethod: item.cookingMethod.trim().slice(0, 120) }
          : {}),
        ...(Array.isArray(item.keyIngredients) && item.keyIngredients.length > 0
          ? {
              keyIngredients: item.keyIngredients
                .slice(0, 6)
                .map((ing) => String(ing).trim().slice(0, 60))
                .filter(Boolean),
            }
          : {}),
        ...(typeof item.oilGheeSugarNote === 'string' && item.oilGheeSugarNote.trim()
          ? { oilGheeSugarNote: item.oilGheeSugarNote.trim().slice(0, 200) }
          : {}),
        ...(item.nutritionSource === 'reference_db' ||
        item.nutritionSource === 'gemini_estimate' ||
        item.nutritionSource === 'unavailable'
          ? { nutritionSource: item.nutritionSource }
          : {}),
        ...(typeof item.referenceFoodId === 'string' && item.referenceFoodId.trim()
          ? { referenceFoodId: item.referenceFoodId.trim().slice(0, 60) }
          : {}),
        portionGrams: Math.round(clampNumber(item.portionGrams, 0, 25000, 0)),
        caloriesKcal: Math.round(clampNumber(item.caloriesKcal, 0, 25000, 0)),
        proteinGrams: Math.round(clampNumber(item.proteinGrams, 0, 2000, 0) * 10) / 10,
        carbsGrams: Math.round(clampNumber(item.carbsGrams, 0, 5000, 0) * 10) / 10,
        fatGrams: Math.round(clampNumber(item.fatGrams, 0, 2000, 0) * 10) / 10,
        fiberGrams: Math.round(clampNumber(item.fiberGrams, 0, 1000, 0) * 10) / 10,
        preparationNote: String(item.preparationNote || 'Standard preparation').slice(0, 200),
      }))
    : [];

  return {
    identificationStatus:
      analysis.identificationStatus === 'needs_clarification' ||
      analysis.identificationStatus === 'not_food'
        ? analysis.identificationStatus
        : 'identified',
    confidence:
      analysis.confidence === 'high' ||
      analysis.confidence === 'medium' ||
      analysis.confidence === 'low'
        ? analysis.confidence
        : 'medium',
    clarificationQuestion: String(analysis.clarificationQuestion || '').slice(0, 500),
    mealTitle: String(analysis.mealTitle || 'Analyzed Meal').slice(0, 200) || 'Analyzed Meal',
    estimatedServingSizeGrams: Math.round(
      clampNumber(analysis.estimatedServingSizeGrams, 0, 25000, 0)
    ),
    servingDescription: String(analysis.servingDescription || '').slice(0, 300),
    totals: {
      caloriesKcal: Math.round(clampNumber(analysis.totals?.caloriesKcal, 0, 25000, 0)),
      proteinGrams:
        Math.round(clampNumber(analysis.totals?.proteinGrams, 0, 2000, 0) * 10) / 10,
      carbsGrams: Math.round(clampNumber(analysis.totals?.carbsGrams, 0, 5000, 0) * 10) / 10,
      fatGrams: Math.round(clampNumber(analysis.totals?.fatGrams, 0, 2000, 0) * 10) / 10,
      fiberGrams: Math.round(clampNumber(analysis.totals?.fiberGrams, 0, 1000, 0) * 10) / 10,
    },
    items,
    dietSuggestions: {
      summary: String(analysis.dietSuggestions?.summary || '').slice(0, 500),
      healthierAlternatives: Array.isArray(analysis.dietSuggestions?.healthierAlternatives)
        ? analysis.dietSuggestions.healthierAlternatives.slice(0, 4)
        : [],
      highProteinOptions: Array.isArray(analysis.dietSuggestions?.highProteinOptions)
        ? analysis.dietSuggestions.highProteinOptions.slice(0, 4)
        : [],
      vegetarianOptions: Array.isArray(analysis.dietSuggestions?.vegetarianOptions)
        ? analysis.dietSuggestions.vegetarianOptions.slice(0, 4)
        : [],
      nonVegetarianOptions: Array.isArray(analysis.dietSuggestions?.nonVegetarianOptions)
        ? analysis.dietSuggestions.nonVegetarianOptions.slice(0, 4)
        : [],
    },
    estimationDisclaimer:
      String(analysis.estimationDisclaimer || '').slice(0, 500) ||
      'Values are visual estimates based on typical portion densities.',
  };
}

function deriveDisplayName(user: User): string {
  const raw =
    user.displayName?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'RosoFood Member';
  return raw.slice(0, 100);
}

export async function ensureUserProfileDocument(
  user: User,
  fallbackGoals: DailyNutritionGoals = DEFAULT_DAILY_GOALS
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = deriveDisplayName(user);
  const email = (user.email || 'user@rosofood.app').slice(0, 254);
  const photoURL = user.photoURL ? user.photoURL.slice(0, 1000) : undefined;

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        ...(photoURL ? { photoURL } : {}),
        dailyGoals: sanitizeDailyGoals(fallbackGoals),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const existing = snap.data();
    const needsIdentitySync =
      existing.displayName !== displayName ||
      existing.email !== email ||
      (photoURL && existing.photoURL !== photoURL);

    if (needsIdentitySync) {
      await updateDoc(ref, {
        displayName,
        email,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserProfile(
  userId: string,
  onProfile: (profile: UserProfileRecord | null) => void
): Unsubscribe {
  const path = `users/${userId}`;
  const ref = doc(db, 'users', userId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      const data = snap.data();
      const dietProfile = sanitizeDietProfile(
        data.dietProfile as Partial<UserDietProfile> | undefined
      );
      onProfile({
        uid: String(data.uid || userId),
        displayName: String(data.displayName || 'RosoFood Member'),
        email: String(data.email || ''),
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        dailyGoals: sanitizeDailyGoals((data.dailyGoals as Partial<DailyNutritionGoals>) || {}),
        dietProfile,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updateUserProfileIdentity(
  user: User,
  displayName: string
): Promise<void> {
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before saving profile changes to the cloud.');
  }
  const cleanName = displayName.trim().slice(0, 100);
  if (!cleanName) {
    throw new Error('Display name cannot be empty.');
  }
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: cleanName,
        email: (user.email || 'user@rosofood.app').slice(0, 254),
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1000) } : {}),
        dailyGoals: sanitizeDailyGoals(DEFAULT_DAILY_GOALS),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: cleanName,
        email: (user.email || 'user@rosofood.app').slice(0, 254),
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1000) } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserDailyGoals(
  userId: string,
  goals: DailyNutritionGoals
): Promise<void> {
  const path = `users/${userId}`;
  const ref = doc(db, 'users', userId);
  try {
    await updateDoc(ref, {
      dailyGoals: sanitizeDailyGoals(goals),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserDietProfile(
  userId: string,
  dietProfile: UserDietProfile
): Promise<void> {
  const path = `users/${userId}`;
  const ref = doc(db, 'users', userId);
  try {
    await updateDoc(ref, {
      dietProfile: sanitizeDietProfile(dietProfile),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserGoalsAndDietProfile(
  userId: string,
  goals: DailyNutritionGoals,
  dietProfile: UserDietProfile
): Promise<void> {
  const path = `users/${userId}`;
  const ref = doc(db, 'users', userId);
  try {
    await updateDoc(ref, {
      dailyGoals: sanitizeDailyGoals(goals),
      dietProfile: sanitizeDietProfile(dietProfile),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToUserMeals(
  userId: string,
  onMeals: (meals: TrackedMealEntry[]) => void
): Unsubscribe {
  const path = `users/${userId}/meals`;
  const q = query(collection(db, 'users', userId, 'meals'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TrackedMealEntry[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || typeof d.dateKey !== 'string' || !d.analysis?.totals) return;
        items.push({
          id: String(d.id || docSnap.id),
          dateKey: d.dateKey,
          loggedAtIso: String(d.loggedAtIso || new Date().toISOString()),
          mealCategory: VALID_CATEGORIES.has(d.mealCategory) ? d.mealCategory : 'Lunch',
          imageThumbnailDataUrl:
            typeof d.imageThumbnailDataUrl === 'string' ? d.imageThumbnailDataUrl : '',
          analysis: d.analysis as FoodAnalysisResult,
        });
      });
      items.sort((a, b) => b.loggedAtIso.localeCompare(a.loggedAtIso));
      onMeals(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveMealForUser(
  userId: string,
  entry: TrackedMealEntry
): Promise<void> {
  const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || `meal-${Date.now()}`;
  const path = `users/${userId}/meals/${safeId}`;
  const ref = doc(db, 'users', userId, 'meals', safeId);

  const safeThumbnail =
    typeof entry.imageThumbnailDataUrl === 'string' &&
    entry.imageThumbnailDataUrl.length <= MAX_THUMBNAIL_CHARS
      ? entry.imageThumbnailDataUrl
      : '';

  const safeCategory: MealCategory = VALID_CATEGORIES.has(entry.mealCategory)
    ? entry.mealCategory
    : 'Lunch';

  try {
    await setDoc(ref, {
      id: safeId,
      userId,
      dateKey: entry.dateKey.slice(0, 10),
      loggedAtIso: entry.loggedAtIso.slice(0, 40),
      mealCategory: safeCategory,
      imageThumbnailDataUrl: safeThumbnail,
      analysis: sanitizeAnalysisForFirestore(entry.analysis),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteMealForUser(userId: string, mealId: string): Promise<void> {
  const path = `users/${userId}/meals/${mealId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'meals', mealId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearDayMealsForUser(
  userId: string,
  mealIds: string[]
): Promise<void> {
  if (mealIds.length === 0) return;
  const path = `users/${userId}/meals`;
  try {
    for (let i = 0; i < mealIds.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = mealIds.slice(i, i + 400);
      for (const id of chunk) {
        batch.delete(doc(db, 'users', userId, 'meals', id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
