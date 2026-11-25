# RosoFood AI Firestore Security Specification

## 1. Data Invariants
1. A `UserProfile` document at `/users/{userId}` can only be read or modified when `request.auth.uid == userId`, with optional `dailyWaterGoalMl` bounded strictly to `500..10000`.
2. Users cannot list `/users` (blanket user directory enumeration is forbidden).
3. All write operations (`create`, `update`, `delete`) require a verified email token (`request.auth.token.email_verified == true`) and strict key/type/size validation.
4. A `TrackedMeal` document at `/users/{userId}/meals/{mealId}` must have `userId == request.auth.uid` and a valid parent `/users/{userId}` profile document (`get()` Master Gate on single-document operations).
5. A `MealPlan` document at `/users/{userId}/mealPlans/{planId}` must have `userId == request.auth.uid`, a valid parent `/users/{userId}` profile document (`get()` Master Gate), strictly 5 planned meal slots (`meals.size() == 5`), safe target calories (`>= 1200`), and bounded text/budget fields.
6. A `WaterLogEntry` document at `/users/{userId}/waterLogs/{entryId}` must have `userId == request.auth.uid`, a valid parent `/users/{userId}` profile document (`get()` Master Gate), `dateKey` matching `YYYY-MM-DD`, and `amountMl` bounded strictly to `10..5000`.
7. A `WeeklyReport` document at `/users/{userId}/weeklyReports/{reportId}` must have `userId == request.auth.uid`, a valid parent `/users/{userId}` profile document (`get()` Master Gate), `days.size() == 7`, bounded macro/water summaries, and valid `YYYY-MM-DD` start/end dates.
8. `uid`, `userId`, `id`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
9. Collection `list` queries on `/users/{userId}/meals`, `/users/{userId}/mealPlans`, `/users/{userId}/waterLogs`, and `/users/{userId}/weeklyReports` enforce `resource.data.userId == request.auth.uid` directly on the resource without `get()` calls.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users/userA`.
2. Authenticated `userB` attempting `get` or `list` on `/users/userA/meals`, `/users/userA/mealPlans`, `/users/userA/waterLogs`, or `/users/userA/weeklyReports`.
3. Authenticated `userA` attempting `list` on `/users` (user PII enumeration).
4. `userA` creating `/users/userA` with `uid: "userB"` (identity spoofing).
5. `userA` creating `/users/userA` with an injected shadow field `isAdmin: true` (schema bypass).
6. `userA` creating `/users/userA/weeklyReports/r1` with `email_verified: false` (unverified write).
7. `userA` creating `/users/userA/weeklyReports/r1` with `id: "../bad/id"` or 500-char ID (path/ID poisoning).
8. `userA` creating `/users/userA/weeklyReports/r1` with a client-forged `createdAt` timestamp != `request.time`.
9. `userA` updating `/users/userA/weeklyReports/r1` to mutate immutable `userId`, `id`, or `createdAt`.
10. `userA` creating `/users/userA/weeklyReports/r1` with `days.size() != 7` or `aiSummary` > 1000 chars.
11. `userA` creating `/users/userA/waterLogs/w1` with `amountMl: -100` or `amountMl: 99999`.
12. `userA` updating `/users/userA` with `dailyWaterGoalMl: 100` or `displayName` > 100 chars.
