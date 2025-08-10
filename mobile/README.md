Micro‑learning app (Expo + React Native)

Setup
- Create `.env` with:
  - `EXPO_PUBLIC_API_BASE_URL` (dev: `http://localhost:3001`)
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (optional; legacy path)
- Install: `npm i`
- Start: `npm run ios` or `npm run android`

Core
- React Query with persistence (AsyncStorage) for fast resume
- SQLite to store progress and download states
- Expo Image for efficient images; prefetch next/prev planned
- QueryProvider and NotificationsProvider wired in `app/_layout.tsx`

API
- Lists courses: `/api/courses?limit=20&page=1&depth=1`
- Modules: `/api/courses/:id/modules?depth=1`
- Module with slides: `/api/modules/:id?depth=2`

Milestones
- M1: Home w/ Continue, Daily goal, Course list; Module viewer with progress
- M2: Offline micro‑bundle prefetch; next/prev slide prefetch
- M3: Micro‑assessments; downloads manager; settings


