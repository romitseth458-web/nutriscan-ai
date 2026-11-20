# NutriScan AI — Food Calorie & Macro Estimator

NutriScan AI is a full-stack food nutrition analyzer built with React, TypeScript, Tailwind CSS, Node.js/Express, and the Gemini Vision API (`@google/genai`). Upload or capture a meal photo to identify visible ingredients, estimate portion sizes in grams, view macro breakdown charts, get tailored vegetarian and non-vegetarian diet suggestions, and log meals in your browser's Daily Food Tracker.

## Features

- **Food Image Upload & Camera Capture**: Supports JPG, JPEG, and PNG uploads up to 8 MB, drag-and-drop, native mobile camera capture (`capture="environment"`), and live browser WebRTC camera capture.
- **Secure Gemini Vision Backend**: All `@google/genai` calls run strictly server-side (`server.ts` + `api/analyze.ts`). Uploaded images are validated by MIME type, size, and magic-byte signatures.
- **Multi-Item Recognition & Clarification**: Identifies multiple distinct foods on a plate, estimates serving weight in grams, and asks the user for clarification when an image is ambiguous or non-food.
- **Nutrition Dashboard & Charts**: Displays calories (`kcal`), protein, carbohydrates, fat, fiber, serving size, a macro energy-split donut chart, daily target bars, and a per-item breakdown table.
- **AI Diet Suggestions**: Provides healthier calorie-saving swaps, high-protein food boosters, and both vegetarian and non-vegetarian alternatives.
- **Daily Food Tracker (LocalStorage)**: Saves meals locally by date (`nutriscan_daily_meals_v1`), totals daily macros against customizable targets (`nutriscan_daily_goals_v1`), and supports inspecting or deleting entries.
- **Installable Progressive Web App (PWA)**: Includes Web App Manifest (`NutriScan AI` / `NutriScan`), 192x192 & 512x512 green-and-white icons, `vite-plugin-pwa` auto-updating service worker, offline fallback page (`/offline.html`), `NetworkOnly` protection for `/api/*`, and an in-app **Install App** button with Android & iOS installation guides.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express (`server.ts`), Vercel Serverless Function (`api/analyze.ts`)
- **AI**: Google Gemini Vision via `@google/genai` (`gemini-4-hydrogen`)
- **Storage**: Browser `localStorage`

## Local Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root (never commit `.env` to Git):

   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

   The full-stack Express + Vite app will run on `http://localhost:3000`.

4. **Type-check & build for production**

   ```bash
   npm run lint
   npm run build
   npm start
   ```

## Deploying to Vercel

This repository includes `vercel.json` and the serverless endpoint `/api/analyze.ts`.

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. In **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY`: your server-side Gemini API key.
4. Click **Deploy**. Vercel will run `npm run build`, serve `dist/`, and expose `/api/analyze` as a Node.js serverless function.
