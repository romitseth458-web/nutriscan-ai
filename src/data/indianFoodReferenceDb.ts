import type { MacroTotals } from '../types/nutrition';

/**
 * Verified Indian Food Reference Nutrition Database (per 100g cooked / edible serving).
 * Values are grounded in ICMR-NIN Indian Food Composition Tables (IFCT 2017) & USDA FoodData Central
 * standardized recipes for typical Indian home & restaurant preparations.
 * Zero browser-only dependencies so both backend (/server, /api) and frontend share one source of truth.
 */
export interface IndianFoodReferenceEntry {
  id: string;
  name: string;
  hindiName: string;
  aliases: string[];
  regionalCuisine: string;
  defaultPortionGrams: number;
  defaultCookingMethod: string;
  defaultOilGheeSugarNote: string;
  defaultIngredients: string[];
  per100g: MacroTotals;
}

export const INDIAN_FOOD_REFERENCE_DB: IndianFoodReferenceEntry[] = [
  // ==================== ROTI, CHAPATI, PARATHA, NAAN & BREADS ====================
  {
    id: 'ref-roti',
    name: 'Whole Wheat Roti / Chapati',
    hindiName: 'रोटी / चपाती / फुल्का',
    aliases: ['roti', 'chapati', 'chapathi', 'phulka', 'fulka', 'wheat roti', 'tandoori roti', 'रोटी', 'चपाती', 'फुल्का'],
    regionalCuisine: 'North & Pan-Indian',
    defaultPortionGrams: 40,
    defaultCookingMethod: 'Dry tawa roasted',
    defaultOilGheeSugarNote: 'Dry roasted whole wheat (minimal/no oil; +35-45 kcal per tsp brushed ghee)',
    defaultIngredients: ['Whole wheat flour (atta)', 'Water'],
    per100g: { caloriesKcal: 264, proteinGrams: 8.5, carbsGrams: 52.5, fatGrams: 2.0, fiberGrams: 7.2 },
  },
  {
    id: 'ref-ghee-roti',
    name: 'Ghee / Butter Roti',
    hindiName: 'घी रोटी / मक्खन चपाती',
    aliases: ['ghee roti', 'butter roti', 'ghee phulka', 'butter chapati', 'घी रोटी'],
    regionalCuisine: 'North Indian',
    defaultPortionGrams: 45,
    defaultCookingMethod: 'Tawa roasted with brushed ghee',
    defaultOilGheeSugarNote: 'Includes ~1/2 to 1 tsp brushed ghee/butter per roti',
    defaultIngredients: ['Whole wheat flour (atta)', 'Water', 'Desi ghee or butter'],
    per100g: { caloriesKcal: 315, proteinGrams: 7.8, carbsGrams: 47.0, fatGrams: 10.5, fiberGrams: 6.4 },
  },
  {
    id: 'ref-plain-paratha',
    name: 'Plain Tawa Paratha',
    hindiName: 'सादा पराठा',
    aliases: ['plain paratha', 'paratha', 'parantha', 'laccha paratha', 'lachha paratha', 'पराठा'],
    regionalCuisine: 'North Indian',
    defaultPortionGrams: 85,
    defaultCookingMethod: 'Pan-griddled with oil/ghee',
    defaultOilGheeSugarNote: 'Includes ~1.5 tsp oil or ghee used for layering and pan roasting',
    defaultIngredients: ['Whole wheat flour', 'Oil or ghee', 'Salt'],
    per100g: { caloriesKcal: 295, proteinGrams: 6.8, carbsGrams: 43.0, fatGrams: 10.8, fiberGrams: 4.5 },
  },
  {
    id: 'ref-aloo-paratha',
    name: 'Aloo Paratha',
    hindiName: 'आलू पराठा',
    aliases: ['aloo paratha', 'stuffed paratha', 'potato paratha', 'gobhi paratha', 'gobi paratha', 'paneer paratha', 'आलू पराठा', 'गोभी पराठा'],
    regionalCuisine: 'Punjabi & North Indian',
    defaultPortionGrams: 140,
    defaultCookingMethod: 'Tawa pan-fried with ghee/oil',
    defaultOilGheeSugarNote: 'Includes ~1.5-2 tsp oil/ghee for shallow roasting (+butter if topped)',
    defaultIngredients: ['Whole wheat flour', 'Spiced mashed potato', 'Green chili', 'Coriander', 'Ghee or oil'],
    per100g: { caloriesKcal: 225, proteinGrams: 4.8, carbsGrams: 32.0, fatGrams: 8.6, fiberGrams: 3.2 },
  },
  {
    id: 'ref-sattu-paratha',
    name: 'Sattu Paratha (Makuni)',
    hindiName: 'सत्तू पराठा / मकुनी',
    aliases: ['sattu paratha', 'makuni', 'bihari sattu paratha', 'सत्तू पराठा'],
    regionalCuisine: 'Bihari',
    defaultPortionGrams: 130,
    defaultCookingMethod: 'Tawa roasted with mustard oil or ghee',
    defaultOilGheeSugarNote: 'Includes roasted gram flour stuffing & ~1.5 tsp ghee/oil',
    defaultIngredients: ['Whole wheat flour', 'Roasted chana sattu', 'Onion', 'Ajwain', 'Mustard oil / ghee'],
    per100g: { caloriesKcal: 255, proteinGrams: 8.4, carbsGrams: 35.5, fatGrams: 8.8, fiberGrams: 4.8 },
  },
  {
    id: 'ref-naan',
    name: 'Tandoori / Butter Naan',
    hindiName: 'नान / बटर नान',
    aliases: ['naan', 'butter naan', 'garlic naan', 'tandoori naan', 'plain naan', 'नान', 'बटर नान'],
    regionalCuisine: 'Punjabi & North Indian',
    defaultPortionGrams: 95,
    defaultCookingMethod: 'Tandoor baked (refined flour)',
    defaultOilGheeSugarNote: 'Made with maida, curd/milk & brushed butter (~1.5 tsp fat per naan)',
    defaultIngredients: ['Refined wheat flour (maida)', 'Yogurt/milk', 'Butter or ghee'],
    per100g: { caloriesKcal: 310, proteinGrams: 8.2, carbsGrams: 50.0, fatGrams: 8.5, fiberGrams: 2.2 },
  },
  {
    id: 'ref-poori',
    name: 'Poori (Deep-Fried)',
    hindiName: 'पूरी',
    aliases: ['poori', 'puri', 'bhatura', 'bhature', 'पूरी', 'भटूरा'],
    regionalCuisine: 'North & Pan-Indian',
    defaultPortionGrams: 40,
    defaultCookingMethod: 'Deep-fried',
    defaultOilGheeSugarNote: 'Deep-fried bread absorbs significant cooking oil (~5-7 g fat per piece)',
    defaultIngredients: ['Wheat or refined flour', 'Cooking oil'],
    per100g: { caloriesKcal: 355, proteinGrams: 7.4, carbsGrams: 46.0, fatGrams: 15.8, fiberGrams: 3.1 },
  },

  // ==================== DAL, RAJMA, CHOLE, KADHI ====================
  {
    id: 'ref-dal-tadka',
    name: 'Dal Tadka (Yellow Lentils)',
    hindiName: 'दाल तड़का / अरहर दाल',
    aliases: ['dal', 'daal', 'dal tadka', 'dal fry', 'yellow dal', 'toor dal', 'arhar dal', 'moong dal', 'masoor dal', 'दाल', 'दाल तड़का', 'दाल फ्राई'],
    regionalCuisine: 'North & Pan-Indian',
    defaultPortionGrams: 200,
    defaultCookingMethod: 'Pressure-cooked with ghee/oil tadka',
    defaultOilGheeSugarNote: 'Includes ~1 to 1.5 tsp ghee or oil in cumin-garlic tempering',
    defaultIngredients: ['Toor/moong lentils', 'Tomato', 'Onion', 'Garlic', 'Cumin', 'Ghee or oil'],
    per100g: { caloriesKcal: 112, proteinGrams: 5.8, carbsGrams: 14.5, fatGrams: 3.4, fiberGrams: 3.1 },
  },
  {
    id: 'ref-dal-makhani',
    name: 'Dal Makhani',
    hindiName: 'दाल मखनी',
    aliases: ['dal makhani', 'black dal', 'ma ki dal', 'दाल मखनी'],
    regionalCuisine: 'Punjabi',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Slow-simmered with butter and cream',
    defaultOilGheeSugarNote: 'Rich butter & fresh cream finish accounts for higher fat calories',
    defaultIngredients: ['Whole black urad dal', 'Rajma', 'Tomato puree', 'Butter', 'Cream'],
    per100g: { caloriesKcal: 158, proteinGrams: 5.8, carbsGrams: 15.5, fatGrams: 8.0, fiberGrams: 3.4 },
  },
  {
    id: 'ref-rajma',
    name: 'Rajma Masala',
    hindiName: 'राजमा मसाला',
    aliases: ['rajma', 'rajma masala', 'rajma curry', 'kidney bean curry', 'राजमा'],
    regionalCuisine: 'Punjabi & North Indian',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Simmered in onion-tomato masala',
    defaultOilGheeSugarNote: 'Moderate cooking oil (~1.5 tsp per bowl) in onion-tomato gravy',
    defaultIngredients: ['Red kidney beans', 'Onion', 'Tomato', 'Ginger-garlic', 'Cooking oil'],
    per100g: { caloriesKcal: 124, proteinGrams: 6.2, carbsGrams: 17.5, fatGrams: 3.2, fiberGrams: 4.5 },
  },
  {
    id: 'ref-chole',
    name: 'Chole / Chana Masala',
    hindiName: 'छोले / चना मसाला',
    aliases: ['chole', 'chhole', 'chana masala', 'chana', 'pindi chole', 'chickpea curry', 'छोले', 'चना मसाला'],
    regionalCuisine: 'Punjabi & North Indian',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Simmered spiced chickpeas',
    defaultOilGheeSugarNote: 'Includes ~1.5-2 tsp cooking oil in spiced onion-tomato gravy',
    defaultIngredients: ['Kabuli chickpeas (chana)', 'Onion', 'Tomato', 'Spices', 'Cooking oil'],
    per100g: { caloriesKcal: 128, proteinGrams: 5.7, carbsGrams: 18.0, fatGrams: 3.6, fiberGrams: 4.3 },
  },
  {
    id: 'ref-kadhi',
    name: 'Kadhi Pakora',
    hindiName: 'कढ़ी पकौड़ा',
    aliases: ['kadhi', 'kadi', 'kadhi pakora', 'besan kadhi', 'gujarati kadhi', 'punjabi kadhi', 'कढ़ी', 'कढ़ी पकौड़ा'],
    regionalCuisine: 'North & Punjabi',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Simmered yogurt-besan gravy with fried pakoras',
    defaultOilGheeSugarNote: 'Includes oil from deep-fried besan pakoras and tadka (~2 tsp oil/ghee)',
    defaultIngredients: ['Sour curd (dahi)', 'Gram flour (besan)', 'Onion pakora', 'Turmeric', 'Mustard/cumin tadka'],
    per100g: { caloriesKcal: 118, proteinGrams: 3.9, carbsGrams: 11.2, fatGrams: 6.2, fiberGrams: 1.5 },
  },

  // ==================== RICE, PULAO, BIRYANI, KHICHDI ====================
  {
    id: 'ref-steamed-rice',
    name: 'Steamed Rice (Chawal / Bhaat)',
    hindiName: 'चावल / भात',
    aliases: ['rice', 'steamed rice', 'white rice', 'basmati rice', 'chawal', 'bhaat', 'plain rice', 'jeera rice', 'चावल', 'भात', 'जीरा राइस'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 160,
    defaultCookingMethod: 'Boiled / steamed',
    defaultOilGheeSugarNote: 'Plain steamed has negligible fat (add ~40 kcal if jeera-ghee tempered)',
    defaultIngredients: ['Rice', 'Water'],
    per100g: { caloriesKcal: 130, proteinGrams: 2.7, carbsGrams: 28.2, fatGrams: 0.3, fiberGrams: 0.4 },
  },
  {
    id: 'ref-pulao',
    name: 'Vegetable Pulao',
    hindiName: 'वेज पुलाव',
    aliases: ['pulao', 'pulav', 'veg pulao', 'vegetable pulao', 'matar pulao', 'peas pulao', 'पुलाव'],
    regionalCuisine: 'North & Pan-Indian',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Sauteed in ghee/oil and steamed',
    defaultOilGheeSugarNote: 'Includes ~1.5-2 tsp ghee/oil per plate for sauteing spices & rice',
    defaultIngredients: ['Basmati rice', 'Green peas', 'Carrots', 'Whole spices', 'Ghee or oil'],
    per100g: { caloriesKcal: 152, proteinGrams: 3.3, carbsGrams: 24.5, fatGrams: 4.5, fiberGrams: 1.8 },
  },
  {
    id: 'ref-veg-biryani',
    name: 'Vegetable Biryani',
    hindiName: 'वेज बिरयानी',
    aliases: ['veg biryani', 'vegetable biryani', 'paneer biryani', 'वेज बिरयानी'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 300,
    defaultCookingMethod: 'Dum steamed layered rice & masala veggies',
    defaultOilGheeSugarNote: 'Includes ghee, fried birista onions & cooking oil (~2.5 tsp fat/plate)',
    defaultIngredients: ['Basmati rice', 'Mixed vegetables', 'Yogurt', 'Fried onions', 'Ghee/oil'],
    per100g: { caloriesKcal: 158, proteinGrams: 3.6, carbsGrams: 23.5, fatGrams: 5.5, fiberGrams: 2.1 },
  },
  {
    id: 'ref-chicken-biryani',
    name: 'Chicken Biryani',
    hindiName: 'चिकन बिरयानी',
    aliases: ['biryani', 'chicken biryani', 'hyderabadi biryani', 'dum biryani', 'mutton biryani', 'egg biryani', 'बिरयानी', 'चिकन बिरयानी'],
    regionalCuisine: 'South & North Indian',
    defaultPortionGrams: 340,
    defaultCookingMethod: 'Dum cooked spiced rice & meat',
    defaultOilGheeSugarNote: 'Includes ghee, oil, and fried onions used in dum layering',
    defaultIngredients: ['Basmati rice', 'Chicken', 'Yogurt marinade', 'Fried onions', 'Ghee/oil'],
    per100g: { caloriesKcal: 168, proteinGrams: 8.2, carbsGrams: 19.5, fatGrams: 6.2, fiberGrams: 0.9 },
  },
  {
    id: 'ref-khichdi',
    name: 'Moong Dal Khichdi',
    hindiName: 'दाल खिचड़ी',
    aliases: ['khichdi', 'khichri', 'dal khichdi', 'moong dal khichdi', 'masala khichdi', 'खिचड़ी'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 250,
    defaultCookingMethod: 'Soft pressure-cooked rice & lentils',
    defaultOilGheeSugarNote: 'Includes ~1 tsp ghee/oil tadka (higher if extra ghee poured on top)',
    defaultIngredients: ['Rice', 'Yellow moong dal', 'Turmeric', 'Cumin', 'Ghee'],
    per100g: { caloriesKcal: 110, proteinGrams: 4.3, carbsGrams: 18.2, fatGrams: 2.1, fiberGrams: 1.9 },
  },

  // ==================== PANEER DISHES & SABZI ====================
  {
    id: 'ref-palak-paneer',
    name: 'Palak Paneer',
    hindiName: 'पालक पनीर',
    aliases: ['palak paneer', 'saag paneer', 'पालक पनीर'],
    regionalCuisine: 'North Indian & Punjabi',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Simmered spinach puree with paneer',
    defaultOilGheeSugarNote: 'Includes paneer fat plus ~1.5 tsp oil/ghee/cream in spinach puree',
    defaultIngredients: ['Fresh spinach (palak)', 'Paneer cubes', 'Onion', 'Tomato', 'Garlic', 'Oil/ghee'],
    per100g: { caloriesKcal: 145, proteinGrams: 7.1, carbsGrams: 5.2, fatGrams: 10.6, fiberGrams: 2.1 },
  },
  {
    id: 'ref-paneer-butter-masala',
    name: 'Paneer Butter Masala / Shahi Paneer',
    hindiName: 'पनीर बटर मसाला / शाही पनीर',
    aliases: ['paneer butter masala', 'shahi paneer', 'kadai paneer', 'matar paneer', 'paneer curry', 'paneer masala', 'पनीर बटर मसाला', 'शाही पनीर', 'मटर पनीर', 'कढ़ाई पनीर'],
    regionalCuisine: 'North Indian & Punjabi',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Rich tomato-cashew-butter gravy',
    defaultOilGheeSugarNote: 'Cream, butter, and cashew paste contribute substantial fat calories; pinch of sugar often added',
    defaultIngredients: ['Paneer', 'Tomato', 'Cashews', 'Butter', 'Cream', 'Spices'],
    per100g: { caloriesKcal: 192, proteinGrams: 7.4, carbsGrams: 7.8, fatGrams: 14.8, fiberGrams: 1.4 },
  },
  {
    id: 'ref-paneer-tikka',
    name: 'Tandoori Paneer Tikka',
    hindiName: 'पनीर टिक्का',
    aliases: ['paneer tikka', 'tandoori paneer', 'पनीर टिक्का'],
    regionalCuisine: 'Punjabi & North Indian',
    defaultPortionGrams: 180,
    defaultCookingMethod: 'Char-grilled in tandoor/pan',
    defaultOilGheeSugarNote: 'Minimal brushed oil/butter during grilling; no heavy cream gravy',
    defaultIngredients: ['Paneer cubes', 'Hung curd marinade', 'Bell pepper', 'Onion', 'Spices'],
    per100g: { caloriesKcal: 162, proteinGrams: 10.8, carbsGrams: 4.5, fatGrams: 11.2, fiberGrams: 1.2 },
  },
  {
    id: 'ref-aloo-gobi',
    name: 'Aloo Gobi Sabzi',
    hindiName: 'आलू गोभी की सब्जी',
    aliases: ['aloo gobi', 'aloo gobhi', 'gobhi sabzi', 'cauliflower potato', 'आलू गोभी'],
    regionalCuisine: 'North Indian',
    defaultPortionGrams: 170,
    defaultCookingMethod: 'Pan-stir-fried dry sabzi',
    defaultOilGheeSugarNote: 'Includes ~1.5-2 tsp cooking oil used in bhuna sauteing',
    defaultIngredients: ['Cauliflower (gobi)', 'Potato (aloo)', 'Turmeric', 'Cumin', 'Cooking oil'],
    per100g: { caloriesKcal: 108, proteinGrams: 2.4, carbsGrams: 14.5, fatGrams: 4.5, fiberGrams: 2.9 },
  },
  {
    id: 'ref-bhindi-masala',
    name: 'Bhindi Masala (Okra Sabzi)',
    hindiName: 'भिंडी मसाला',
    aliases: ['bhindi', 'bhindi masala', 'bhindi fry', 'okra sabzi', 'sabzi', 'mix veg', 'mixed veg sabzi', 'aloo matar', 'भिंडी', 'मिक्स वेज', 'सब्जी'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 160,
    defaultCookingMethod: 'Pan-sauteed dry vegetable sabzi',
    defaultOilGheeSugarNote: 'Includes ~1.5-2 tsp oil per serving to stir-fry',
    defaultIngredients: ['Okra/mixed seasonal vegetables', 'Onion', 'Spices', 'Cooking oil'],
    per100g: { caloriesKcal: 104, proteinGrams: 2.5, carbsGrams: 10.8, fatGrams: 5.6, fiberGrams: 3.4 },
  },
  {
    id: 'ref-baingan-chokha',
    name: 'Baingan Bharta / Chokha',
    hindiName: 'बैंगन भर्ता / चोखा',
    aliases: ['chokha', 'baingan chokha', 'aloo chokha', 'baingan bharta', 'bharta', 'चोखा', 'बैंगन भर्ता'],
    regionalCuisine: 'Bihari & North Indian',
    defaultPortionGrams: 150,
    defaultCookingMethod: 'Fire-roasted and mashed',
    defaultOilGheeSugarNote: 'Traditional Chokha uses ~1 tsp raw mustard oil; restaurant bharta may use more',
    defaultIngredients: ['Roasted brinjal/eggplant', 'Roasted potato/tomato', 'Garlic', 'Green chili', 'Mustard oil'],
    per100g: { caloriesKcal: 86, proteinGrams: 1.8, carbsGrams: 10.5, fatGrams: 4.1, fiberGrams: 3.0 },
  },
  {
    id: 'ref-sarson-saag',
    name: 'Sarson ka Saag',
    hindiName: 'सरसों का साग',
    aliases: ['sarson ka saag', 'sarson da saag', 'saag', 'सरसों का साग'],
    regionalCuisine: 'Punjabi',
    defaultPortionGrams: 200,
    defaultCookingMethod: 'Slow-cooked mustard greens with butter/ghee tadka',
    defaultOilGheeSugarNote: 'Includes white butter/ghee added while tempering & serving',
    defaultIngredients: ['Mustard greens', 'Spinach', 'Bathua', 'Makki atta', 'Ghee/butter'],
    per100g: { caloriesKcal: 96, proteinGrams: 3.6, carbsGrams: 7.4, fatGrams: 5.8, fiberGrams: 3.6 },
  },

  // ==================== SOUTH INDIAN: DOSA, IDLI, SAMBAR, VADA, POHA, UPMA ====================
  {
    id: 'ref-masala-dosa',
    name: 'Masala Dosa',
    hindiName: 'मसाला डोसा',
    aliases: ['masala dosa', 'mysore masala dosa', 'ghee roast dosa', 'मसाला डोसा'],
    regionalCuisine: 'South Indian',
    defaultPortionGrams: 210,
    defaultCookingMethod: 'Tawa crisped crepe with oil/ghee + potato masala',
    defaultOilGheeSugarNote: 'Includes ~2 tsp oil/ghee for crepe roasting and potato bhaji tempering',
    defaultIngredients: ['Fermented rice-urad batter', 'Spiced potato filling', 'Oil or ghee'],
    per100g: { caloriesKcal: 178, proteinGrams: 3.9, carbsGrams: 27.5, fatGrams: 5.8, fiberGrams: 2.2 },
  },
  {
    id: 'ref-plain-dosa',
    name: 'Plain Dosa',
    hindiName: 'प्लेन डोसा',
    aliases: ['dosa', 'plain dosa', 'sada dosa', 'rava dosa', 'uttapam', 'डोसा', 'उत्तपम'],
    regionalCuisine: 'South Indian',
    defaultPortionGrams: 110,
    defaultCookingMethod: 'Tawa roasted fermented crepe',
    defaultOilGheeSugarNote: 'Includes ~1 tsp oil/ghee brushed on the griddle',
    defaultIngredients: ['Fermented rice & urad dal batter', 'Oil or ghee'],
    per100g: { caloriesKcal: 168, proteinGrams: 4.1, carbsGrams: 28.5, fatGrams: 4.1, fiberGrams: 1.4 },
  },
  {
    id: 'ref-idli',
    name: 'Steamed Idli',
    hindiName: 'इडली',
    aliases: ['idli', 'idly', 'rava idli', 'steamed idli', 'इडली'],
    regionalCuisine: 'South Indian',
    defaultPortionGrams: 100,
    defaultCookingMethod: 'Steamed (oil-free)',
    defaultOilGheeSugarNote: 'Steamed without oil; light, low-fat fermented breakfast',
    defaultIngredients: ['Fermented parboiled rice', 'Urad dal'],
    per100g: { caloriesKcal: 132, proteinGrams: 4.2, carbsGrams: 27.2, fatGrams: 0.6, fiberGrams: 1.4 },
  },
  {
    id: 'ref-sambar',
    name: 'South Indian Sambar',
    hindiName: 'सांभर',
    aliases: ['sambar', 'sambhar', 'rasam', 'सांभर'],
    regionalCuisine: 'South Indian',
    defaultPortionGrams: 150,
    defaultCookingMethod: 'Boiled lentil-vegetable stew with tadka',
    defaultOilGheeSugarNote: 'Very light cooking oil (~0.5-1 tsp mustard-curry leaf tadka per bowl)',
    defaultIngredients: ['Toor dal', 'Drumstick', 'Carrot', 'Tamarind', 'Sambar powder', 'Curry leaves'],
    per100g: { caloriesKcal: 62, proteinGrams: 2.8, carbsGrams: 9.6, fatGrams: 1.4, fiberGrams: 2.2 },
  },
  {
    id: 'ref-medu-vada',
    name: 'Medu Vada (Crispy Lentil Donut)',
    hindiName: 'मेदु वड़ा',
    aliases: ['vada', 'medu vada', 'urad vada', 'dahi vada', 'wada', 'वड़ा', 'मेदु वड़ा'],
    regionalCuisine: 'South Indian',
    defaultPortionGrams: 65,
    defaultCookingMethod: 'Deep-fried',
    defaultOilGheeSugarNote: 'Deep-fried urad batter absorbs substantial oil (~7-9 g fat per vada)',
    defaultIngredients: ['Urad dal batter', 'Curry leaves', 'Black pepper', 'Deep-frying oil'],
    per100g: { caloriesKcal: 298, proteinGrams: 10.2, carbsGrams: 30.5, fatGrams: 15.2, fiberGrams: 4.4 },
  },
  {
    id: 'ref-coconut-chutney',
    name: 'Coconut Chutney',
    hindiName: 'नारियल चटनी',
    aliases: ['coconut chutney', 'white chutney', 'nariyal chutney', 'नारियल चटनी'],
    regionalCuisine: 'South Indian',
    defaultPortionGrams: 45,
    defaultCookingMethod: 'Fresh ground with oil tadka',
    defaultOilGheeSugarNote: 'Calorie-dense due to natural coconut fat + roasted chana dal + tadka',
    defaultIngredients: ['Fresh coconut', 'Roasted chana dal', 'Green chili', 'Curry leaf tadka'],
    per100g: { caloriesKcal: 195, proteinGrams: 3.4, carbsGrams: 9.5, fatGrams: 16.5, fiberGrams: 4.6 },
  },
  {
    id: 'ref-poha',
    name: 'Kanda / Vegetable Poha',
    hindiName: 'पोहा / कांदा पोहा',
    aliases: ['poha', 'kanda poha', 'batata poha', 'chivda', 'पोहा'],
    regionalCuisine: 'Pan-Indian & Maharashtrian',
    defaultPortionGrams: 180,
    defaultCookingMethod: 'Steamed flattened rice tempered in oil',
    defaultOilGheeSugarNote: 'Includes ~1 tsp oil and roasted peanuts (+extra calories if sev added)',
    defaultIngredients: ['Flattened rice (poha)', 'Onion', 'Peanuts', 'Turmeric', 'Mustard seeds', 'Oil'],
    per100g: { caloriesKcal: 139, proteinGrams: 3.1, carbsGrams: 23.3, fatGrams: 3.6, fiberGrams: 1.7 },
  },
  {
    id: 'ref-upma',
    name: 'Rava / Sooji Upma',
    hindiName: 'उपमा / सूजी उपमा',
    aliases: ['upma', 'rava upma', 'sooji upma', 'suji upma', 'vegetable upma', 'उपमा'],
    regionalCuisine: 'South & Pan-Indian',
    defaultPortionGrams: 180,
    defaultCookingMethod: 'Roasted semolina cooked with tempered veggies',
    defaultOilGheeSugarNote: 'Includes ~1-1.5 tsp ghee/oil in roasting and mustard-urad tempering',
    defaultIngredients: ['Semolina (suji/rava)', 'Onion', 'Carrot/peas', 'Curry leaves', 'Ghee or oil'],
    per100g: { caloriesKcal: 132, proteinGrams: 3.3, carbsGrams: 21.0, fatGrams: 3.8, fiberGrams: 1.6 },
  },

  // ==================== SAMOSA, PAKORA, DHOKLA, LITTI CHOKHA & REGIONAL ====================
  {
    id: 'ref-samosa',
    name: 'Potato Samosa',
    hindiName: 'समोसा',
    aliases: ['samosa', 'aloo samosa', 'punjabi samosa', 'समोसा'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 100,
    defaultCookingMethod: 'Deep-fried crisp pastry',
    defaultOilGheeSugarNote: 'Maida pastry with moyan fat + deep-frying yields ~13-15 g fat per samosa',
    defaultIngredients: ['Refined flour shell', 'Spiced potato & peas', 'Frying oil'],
    per100g: { caloriesKcal: 262, proteinGrams: 4.5, carbsGrams: 31.0, fatGrams: 13.5, fiberGrams: 3.0 },
  },
  {
    id: 'ref-pakora',
    name: 'Onion / Mix Veg Pakora (Bhajiya)',
    hindiName: 'पकोड़ा / भजिया',
    aliases: ['pakora', 'pakoda', 'bhajiya', 'pyaz pakora', 'paneer pakora', 'bread pakora', 'पकोड़ा', 'भजिया'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 100,
    defaultCookingMethod: 'Deep-fried gram flour fritters',
    defaultOilGheeSugarNote: 'Deep-fried batter absorbs high oil (~15-18 g fat per 100 g)',
    defaultIngredients: ['Gram flour (besan)', 'Onion / potato / veggies', 'Spices', 'Frying oil'],
    per100g: { caloriesKcal: 288, proteinGrams: 6.8, carbsGrams: 27.5, fatGrams: 16.8, fiberGrams: 3.6 },
  },
  {
    id: 'ref-dhokla',
    name: 'Khaman Dhokla',
    hindiName: 'खमन ढोकला',
    aliases: ['dhokla', 'khaman', 'khaman dhokla', 'besan dhokla', 'ढोकला', 'खमन'],
    regionalCuisine: 'Gujarati & Pan-Indian',
    defaultPortionGrams: 150,
    defaultCookingMethod: 'Steamed with light sweet-savory tempering',
    defaultOilGheeSugarNote: 'Steamed base is low fat; sugar-mustard tadka adds ~1 tsp oil + ~1 tsp sugar',
    defaultIngredients: ['Gram flour (besan)', 'Mustard seeds', 'Curry leaves', 'Oil', 'Pinch of sugar'],
    per100g: { caloriesKcal: 145, proteinGrams: 5.7, carbsGrams: 21.3, fatGrams: 3.7, fiberGrams: 2.3 },
  },
  {
    id: 'ref-litti-chokha',
    name: 'Litti Chokha',
    hindiName: 'लिट्टी चोखा',
    aliases: ['litti chokha', 'litti', 'baati chokha', 'dal baati', 'लिट्टी चोखा', 'लिट्टी'],
    regionalCuisine: 'Bihari',
    defaultPortionGrams: 260,
    defaultCookingMethod: 'Baked/roasted wheat-sattu balls dipped in ghee + roasted chokha',
    defaultOilGheeSugarNote: 'Calories vary strongly with ghee dipping (includes ~2 tsp ghee + mustard oil in chokha)',
    defaultIngredients: ['Whole wheat atta', 'Roasted chana sattu', 'Desi ghee', 'Roasted brinjal-tomato-potato chokha', 'Mustard oil'],
    per100g: { caloriesKcal: 205, proteinGrams: 6.2, carbsGrams: 28.5, fatGrams: 7.4, fiberGrams: 4.1 },
  },
  {
    id: 'ref-macher-jhol',
    name: 'Macher Jhol (Bengali Fish Curry)',
    hindiName: 'माछेर झोल / बंगाली मछली करी',
    aliases: ['macher jhol', 'bengali fish curry', 'fish curry', 'machher jhol', 'rohu curry', 'माछेर झोल'],
    regionalCuisine: 'Bengali',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Light mustard-oil simmered fish & potato gravy',
    defaultOilGheeSugarNote: 'Uses ~1.5 tsp mustard oil; lighter than creamy North Indian gravies',
    defaultIngredients: ['Rohu or catla fish', 'Potato', 'Tomato', 'Turmeric', 'Mustard oil'],
    per100g: { caloriesKcal: 118, proteinGrams: 11.4, carbsGrams: 5.2, fatGrams: 5.6, fiberGrams: 0.9 },
  },
  {
    id: 'ref-pav-bhaji',
    name: 'Pav Bhaji',
    hindiName: 'पाव भाजी',
    aliases: ['pav bhaji', 'bhaji pav', 'पाव भाजी'],
    regionalCuisine: 'Maharashtrian & Street Food',
    defaultPortionGrams: 320,
    defaultCookingMethod: 'Butter-toasted pav + spiced mashed vegetable bhaji',
    defaultOilGheeSugarNote: 'Heavy butter on both bhaji and toasted pav contributes high saturated fat',
    defaultIngredients: ['Potato & mixed veggies', 'Maida pav buns', 'Amul butter', 'Spices'],
    per100g: { caloriesKcal: 175, proteinGrams: 4.1, carbsGrams: 23.1, fatGrams: 7.2, fiberGrams: 2.3 },
  },

  // ==================== INDIAN SWEETS (MITHAI) ====================
  {
    id: 'ref-gulab-jamun',
    name: 'Gulab Jamun',
    hindiName: 'गुलाब जामुन',
    aliases: ['gulab jamun', 'gulab jamoon', 'kala jamun', 'गुलाब जामुन'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 50,
    defaultCookingMethod: 'Deep-fried khoya balls soaked in sugar syrup',
    defaultOilGheeSugarNote: 'High added sugar syrup + ghee/oil deep-frying',
    defaultIngredients: ['Khoya (milk solids)', 'Maida', 'Ghee/oil', 'Sugar syrup', 'Cardamom'],
    per100g: { caloriesKcal: 318, proteinGrams: 4.2, carbsGrams: 48.0, fatGrams: 12.2, fiberGrams: 0.4 },
  },
  {
    id: 'ref-jalebi',
    name: 'Crispy Jalebi',
    hindiName: 'जलेबी',
    aliases: ['jalebi', 'imarti', 'जलेबी', 'इमरती'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 60,
    defaultCookingMethod: 'Deep-fried fermented spirals dipped in sugar syrup',
    defaultOilGheeSugarNote: 'Very high refined sugar syrup + frying oil/ghee',
    defaultIngredients: ['Fermented maida batter', 'Sugar syrup', 'Saffron', 'Frying oil/ghee'],
    per100g: { caloriesKcal: 355, proteinGrams: 2.8, carbsGrams: 62.0, fatGrams: 11.2, fiberGrams: 0.5 },
  },
  {
    id: 'ref-rasgulla',
    name: 'Rasgulla',
    hindiName: 'रसगुल्ला',
    aliases: ['rasgulla', 'rosogolla', 'rasgolla', 'रसगुल्ला', 'रसोगोल्ला'],
    regionalCuisine: 'Bengali & Pan-Indian',
    defaultPortionGrams: 55,
    defaultCookingMethod: 'Chhena balls boiled in light sugar syrup (not fried)',
    defaultOilGheeSugarNote: 'Lower fat than fried sweets, but soaked in sugar syrup (~18-22 g sugar/piece)',
    defaultIngredients: ['Fresh chhena (curdled milk)', 'Sugar syrup', 'Cardamom'],
    per100g: { caloriesKcal: 186, proteinGrams: 4.0, carbsGrams: 39.5, fatGrams: 1.6, fiberGrams: 0 },
  },

  // ==================== INDIAN FRUITS & BEVERAGES ====================
  {
    id: 'ref-masala-chai',
    name: 'Masala Chai',
    hindiName: 'मसाला चाय',
    aliases: ['chai', 'masala chai', 'tea', 'milk tea', 'adrak chai', 'चाय', 'मसाला चाय'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 180,
    defaultCookingMethod: 'Boiled milk, tea leaves & spices with sugar',
    defaultOilGheeSugarNote: 'Standard cup includes ~1-1.5 tsp added sugar (~25-30 kcal)',
    defaultIngredients: ['Whole/toned milk', 'Water', 'Tea leaves', 'Ginger/cardamom', 'Sugar'],
    per100g: { caloriesKcal: 48, proteinGrams: 1.6, carbsGrams: 6.1, fatGrams: 1.8, fiberGrams: 0 },
  },
  {
    id: 'ref-sweet-lassi',
    name: 'Sweet Punjabi Lassi',
    hindiName: 'मीठी लस्सी',
    aliases: ['lassi', 'sweet lassi', 'punjabi lassi', 'mango lassi', 'लस्सी'],
    regionalCuisine: 'Punjabi',
    defaultPortionGrams: 250,
    defaultCookingMethod: 'Churned yogurt drink with sugar',
    defaultOilGheeSugarNote: 'Typically includes ~2 tbsp added sugar (+malai topping if restaurant style)',
    defaultIngredients: ['Curd (dahi)', 'Sugar', 'Cardamom', 'Water/ice'],
    per100g: { caloriesKcal: 92, proteinGrams: 3.1, carbsGrams: 14.2, fatGrams: 2.5, fiberGrams: 0 },
  },
  {
    id: 'ref-chaas',
    name: 'Spiced Buttermilk (Chaas)',
    hindiName: 'छाछ / मट्ठा',
    aliases: ['chaas', 'chas', 'buttermilk', 'mattha', 'छाछ', 'मट्ठा'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 250,
    defaultCookingMethod: 'Diluted whisked yogurt with roasted cumin',
    defaultOilGheeSugarNote: 'Zero added sugar or oil; light probiotic beverage',
    defaultIngredients: ['Curd (dahi)', 'Water', 'Roasted jeera', 'Black salt', 'Coriander'],
    per100g: { caloriesKcal: 26, proteinGrams: 1.4, carbsGrams: 2.6, fatGrams: 1.0, fiberGrams: 0 },
  },
  {
    id: 'ref-mango',
    name: 'Fresh Mango Slices',
    hindiName: 'आम',
    aliases: ['mango', 'aam', 'alphonso mango', 'kesar mango', 'आम'],
    regionalCuisine: 'Pan-Indian Fruit',
    defaultPortionGrams: 165,
    defaultCookingMethod: 'Fresh raw fruit',
    defaultOilGheeSugarNote: 'Natural fruit sugars only; zero added oil or sugar',
    defaultIngredients: ['Ripe mango'],
    per100g: { caloriesKcal: 60, proteinGrams: 0.8, carbsGrams: 15.0, fatGrams: 0.4, fiberGrams: 1.6 },
  },
  {
    id: 'ref-banana',
    name: 'Ripe Banana',
    hindiName: 'केला',
    aliases: ['banana', 'kela', 'केला'],
    regionalCuisine: 'Pan-Indian Fruit',
    defaultPortionGrams: 118,
    defaultCookingMethod: 'Fresh raw fruit',
    defaultOilGheeSugarNote: 'Natural fruit carbs; zero added fat',
    defaultIngredients: ['Banana'],
    per100g: { caloriesKcal: 89, proteinGrams: 1.1, carbsGrams: 22.8, fatGrams: 0.3, fiberGrams: 2.6 },
  },
  {
    id: 'ref-apple',
    name: 'Fresh Apple',
    hindiName: 'सेब',
    aliases: ['apple', 'seb', 'fresh apple', 'सेब'],
    regionalCuisine: 'Pan-Indian Fruit',
    defaultPortionGrams: 150,
    defaultCookingMethod: 'Fresh raw fruit',
    defaultOilGheeSugarNote: 'Zero added fat or sugar; high soluble fiber',
    defaultIngredients: ['Fresh apple'],
    per100g: { caloriesKcal: 52, proteinGrams: 0.3, carbsGrams: 13.8, fatGrams: 0.2, fiberGrams: 2.4 },
  },

  // ==================== EVERYDAY AFFORDABLE INDIAN DIET STAPLES ====================
  {
    id: 'ref-boiled-eggs',
    name: 'Boiled Eggs',
    hindiName: 'उबले अंडे',
    aliases: ['boiled egg', 'boiled eggs', 'eggs', 'egg', 'anda', 'उबला अंडा', 'अंडे'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 100,
    defaultCookingMethod: 'Hard-boiled (oil-free)',
    defaultOilGheeSugarNote: 'Oil-free complete protein (~6.5 g protein per 50 g whole egg)',
    defaultIngredients: ['Whole eggs'],
    per100g: { caloriesKcal: 155, proteinGrams: 12.6, carbsGrams: 1.1, fatGrams: 10.6, fiberGrams: 0 },
  },
  {
    id: 'ref-egg-bhurji-omelette',
    name: 'Egg Bhurji / Masala Omelette',
    hindiName: 'अंडा भुर्जी / मसाला ऑमलेट',
    aliases: ['egg bhurji', 'anda bhurji', 'omelette', 'masala omelette', 'egg omelette', 'egg curry', 'अंडा भुर्जी', 'ऑमलेट'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 130,
    defaultCookingMethod: 'Pan-cooked with onion, tomato & ~1 tsp oil',
    defaultOilGheeSugarNote: 'Includes ~1 tsp cooking oil or butter plus whole eggs',
    defaultIngredients: ['Whole eggs', 'Onion', 'Tomato', 'Green chili', 'Cooking oil'],
    per100g: { caloriesKcal: 162, proteinGrams: 10.6, carbsGrams: 3.1, fatGrams: 11.8, fiberGrams: 0.6 },
  },
  {
    id: 'ref-toned-milk',
    name: 'Toned Milk (Warm / Plain)',
    hindiName: 'टोन्ड दूध',
    aliases: ['milk', 'toned milk', 'cow milk', 'doodh', 'warm milk', 'दूध'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 250,
    defaultCookingMethod: 'Boiled dairy milk (unsweetened)',
    defaultOilGheeSugarNote: 'Standard 3% fat toned milk; zero added sugar',
    defaultIngredients: ['Toned cow/buffalo milk'],
    per100g: { caloriesKcal: 58, proteinGrams: 3.1, carbsGrams: 4.8, fatGrams: 3.0, fiberGrams: 0 },
  },
  {
    id: 'ref-plain-curd',
    name: 'Plain Homemade Curd (Dahi)',
    hindiName: 'दही',
    aliases: ['curd', 'dahi', 'yogurt', 'yoghurt', 'raita', 'boondi raita', 'दही', 'रायता'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 150,
    defaultCookingMethod: 'Fermented dairy',
    defaultOilGheeSugarNote: 'Natural dairy fat only; zero added sugar',
    defaultIngredients: ['Cultured milk (dahi)'],
    per100g: { caloriesKcal: 62, proteinGrams: 3.3, carbsGrams: 4.5, fatGrams: 3.4, fiberGrams: 0 },
  },
  {
    id: 'ref-oats-porridge',
    name: 'Masala Oats / Milk Oats Porridge',
    hindiName: 'मसाला ओट्स / दूध ओट्स',
    aliases: ['oats', 'masala oats', 'oats porridge', 'oatmeal', 'oats cheela', 'vegetable oats', 'ओट्स'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 220,
    defaultCookingMethod: 'Simmered rolled oats with vegetables or milk',
    defaultOilGheeSugarNote: 'Minimal oil/butter; complex whole-grain carbohydrates and soluble beta-glucan fiber',
    defaultIngredients: ['Rolled oats', 'Water or toned milk', 'Seasonal vegetables or spices'],
    per100g: { caloriesKcal: 92, proteinGrams: 3.4, carbsGrams: 15.2, fatGrams: 1.8, fiberGrams: 2.3 },
  },
  {
    id: 'ref-besan-chilla',
    name: 'Besan / Moong Dal Chilla',
    hindiName: 'बेसन चीला / मूंग दाल चीला',
    aliases: ['besan chilla', 'besan cheela', 'moong dal chilla', 'cheela', 'chilla', 'बेसन चीला', 'मूंग दाल चीला'],
    regionalCuisine: 'North & Pan-Indian',
    defaultPortionGrams: 130,
    defaultCookingMethod: 'Tawa pan-griddled savory pancake',
    defaultOilGheeSugarNote: 'Includes ~1 tsp oil brushed for tawa roasting; high plant protein',
    defaultIngredients: ['Gram flour (besan) or soaked moong dal', 'Onion', 'Coriander', 'Spices', 'Oil'],
    per100g: { caloriesKcal: 178, proteinGrams: 8.6, carbsGrams: 22.0, fatGrams: 5.8, fiberGrams: 3.9 },
  },
  {
    id: 'ref-roasted-chana-sattu',
    name: 'Roasted Chana / Sattu Drink',
    hindiName: 'भुना चना / सत्तू',
    aliases: ['roasted chana', 'bhuna chana', 'sattu', 'sattu drink', 'chana sattu', 'भुना चना', 'सत्तू'],
    regionalCuisine: 'Bihari & North Indian',
    defaultPortionGrams: 40,
    defaultCookingMethod: 'Dry roasted Bengal gram (whole or flour)',
    defaultOilGheeSugarNote: 'Oil-free high-protein & fiber snack',
    defaultIngredients: ['Dry roasted Bengal gram (chana)'],
    per100g: { caloriesKcal: 369, proteinGrams: 21.5, carbsGrams: 58.2, fatGrams: 5.3, fiberGrams: 14.2 },
  },
  {
    id: 'ref-sprouts-chaat',
    name: 'Sprouted Moong Chaat',
    hindiName: 'अंकुरित मूंग चाट',
    aliases: ['sprouts', 'moong sprouts', 'sprouted moong', 'sprouts chaat', 'chana sprouts', 'अंकुरित मूंग'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 120,
    defaultCookingMethod: 'Lightly steamed / fresh tossed with lemon & onion',
    defaultOilGheeSugarNote: 'Zero added oil; high plant protein and dietary fiber',
    defaultIngredients: ['Sprouted green moong', 'Onion', 'Tomato', 'Lemon juice', 'Chaat masala'],
    per100g: { caloriesKcal: 88, proteinGrams: 6.4, carbsGrams: 14.8, fatGrams: 0.4, fiberGrams: 4.2 },
  },
  {
    id: 'ref-paneer-bhurji',
    name: 'Homemade Paneer Bhurji',
    hindiName: 'पनीर भुर्जी',
    aliases: ['paneer bhurji', 'paneer', 'scrambled paneer', 'पनीर भुर्जी', 'पनीर'],
    regionalCuisine: 'North Indian',
    defaultPortionGrams: 150,
    defaultCookingMethod: 'Pan-sauteed crumbled paneer with onion & tomato',
    defaultOilGheeSugarNote: 'Includes natural paneer fat + ~1 tsp cooking oil/ghee',
    defaultIngredients: ['Crumbled paneer', 'Onion', 'Tomato', 'Turmeric', 'Cooking oil'],
    per100g: { caloriesKcal: 218, proteinGrams: 12.8, carbsGrams: 5.2, fatGrams: 16.2, fiberGrams: 0.9 },
  },
  {
    id: 'ref-soya-chunks-curry',
    name: 'Soya Chunks Masala / Sabzi',
    hindiName: 'सोया चंक्स सब्जी',
    aliases: ['soya chunks', 'soya badi', 'nutrela', 'soya curry', 'soya sabzi', 'सोया चंक्स'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 180,
    defaultCookingMethod: 'Boiled & simmered in light tomato-onion masala',
    defaultOilGheeSugarNote: 'Budget-friendly ultra-high vegetarian protein with ~1 tsp cooking oil',
    defaultIngredients: ['Textured soy protein chunks (cooked)', 'Onion', 'Tomato', 'Ginger-garlic', 'Oil'],
    per100g: { caloriesKcal: 132, proteinGrams: 15.8, carbsGrams: 10.6, fatGrams: 2.6, fiberGrams: 3.8 },
  },
  {
    id: 'ref-roasted-peanuts',
    name: 'Roasted Peanuts',
    hindiName: 'भुनी मूंगफली',
    aliases: ['peanuts', 'roasted peanuts', 'moongfali', 'mungfali', 'मूंगफली'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 25,
    defaultCookingMethod: 'Dry roasted',
    defaultOilGheeSugarNote: 'Nutrient-dense healthy fats & protein; watch portion grams',
    defaultIngredients: ['Peanuts'],
    per100g: { caloriesKcal: 585, proteinGrams: 25.2, carbsGrams: 18.5, fatGrams: 49.5, fiberGrams: 8.4 },
  },
  {
    id: 'ref-chicken-curry-home',
    name: 'Homestyle Chicken Curry / Grilled Chicken',
    hindiName: 'चिकन करी / ग्रिल्ड चिकन',
    aliases: ['chicken curry', 'homestyle chicken', 'grilled chicken', 'tandoori chicken', 'chicken breast', 'चिकन करी', 'तंदूरी चिकन'],
    regionalCuisine: 'Pan-Indian',
    defaultPortionGrams: 180,
    defaultCookingMethod: 'Simmered in light onion-tomato gravy or grilled',
    defaultOilGheeSugarNote: 'High-protein lean poultry with ~1-1.5 tsp oil',
    defaultIngredients: ['Chicken', 'Onion', 'Tomato', 'Ginger-garlic', 'Spices', 'Oil'],
    per100g: { caloriesKcal: 152, proteinGrams: 18.4, carbsGrams: 4.2, fatGrams: 6.8, fiberGrams: 0.7 },
  },
];

function normalizeFoodText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[()/,.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches a dish name (English or Hindi) against the verified Indian Food Reference DB.
 * Returns null when no trustworthy high-confidence match exists (avoiding false matches).
 */
export function findIndianFoodReference(dishName: string): IndianFoodReferenceEntry | null {
  const normQuery = normalizeFoodText(dishName);
  if (!normQuery || normQuery.length < 2) return null;

  let bestMatch: IndianFoodReferenceEntry | null = null;
  let bestScore = 0;

  for (const entry of INDIAN_FOOD_REFERENCE_DB) {
    const candidates = [entry.name, entry.hindiName, ...entry.aliases];
    for (const candidate of candidates) {
      const normCandidate = normalizeFoodText(candidate);
      if (!normCandidate) continue;

      let score = 0;
      if (normQuery === normCandidate) {
        score = 100 + normCandidate.length;
      } else if (
        normCandidate.length >= 4 &&
        (normQuery.includes(` ${normCandidate} `) ||
          normQuery.startsWith(`${normCandidate} `) ||
          normQuery.endsWith(` ${normCandidate}`))
      ) {
        score = 70 + normCandidate.length;
      } else if (
        normQuery.length >= 4 &&
        normCandidate.length >= 4 &&
        normQuery.includes(normCandidate)
      ) {
        score = 50 + normCandidate.length;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

function round1(val: number): number {
  return Math.round(Math.max(0, val) * 10) / 10;
}

export function computeMacrosFromReference(
  entry: IndianFoodReferenceEntry,
  portionGrams: number
): MacroTotals {
  const safeGrams = Math.max(1, Math.min(2500, Math.round(portionGrams || entry.defaultPortionGrams)));
  const factor = safeGrams / 100;
  return {
    caloriesKcal: Math.round(entry.per100g.caloriesKcal * factor),
    proteinGrams: round1(entry.per100g.proteinGrams * factor),
    carbsGrams: round1(entry.per100g.carbsGrams * factor),
    fatGrams: round1(entry.per100g.fatGrams * factor),
    fiberGrams: round1(entry.per100g.fiberGrams * factor),
  };
}
