# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Product/domain context (project overview, tech stack, domain model, priority tiers, the
alerts-feed design, the admin-app scope boundary) lives in `AGENTS.md`, imported above —
this file covers commands and engineering architecture, not product context.

## Commands

- `npm start` or `npx expo start` — start the Metro dev server
- `npm run android` / `npm run ios` / `npm run web` — start Metro targeting a platform
- `npm run lint` — run `expo lint` (ESLint, flat config via `eslint-config-expo`)
- `npx tsc --noEmit` — type-check
- `npx convex dev` — provision/sync the Convex backend (interactive: GitHub login on
  first run). Required once before the app will build — see "Setup still required" below
- `bun add <pkg>` — this repo uses **bun** as its package manager (`bun.lock` is
  authoritative); prefer `npx expo install <pkg>` for native modules so the Expo-SDK-
  compatible version gets picked

No test runner is configured (no `test` script in `package.json`).

## Setup still required (not done by this session — needs your interactive input)

1. **`npx convex dev`** — logs into Convex via GitHub, provisions the backend project,
   writes `EXPO_PUBLIC_CONVEX_URL` to `.env.local`, and generates `convex/_generated/`
   (referenced by every file in `convex/` — until this runs, those files show
   `implicitly has an 'any' type` errors under `tsc --noEmit`, which is expected).
2. **`npx @convex-dev/auth`** — finishes Convex Auth setup (generates/sets the JWT
   signing keys as Convex env vars). Run after step 1.
3. **First `npx expo start`** — Metro generates `uniwind-types.d.ts` and
   `expo-env.d.ts` on first bundle. Until then, `className` on core RN components
   (`View`, `Text`, `Pressable`) shows as a type error under `tsc --noEmit` — also
   expected, not a bug.

## Architecture

### Routing (`app/`, Expo Router, typed routes on)

- `app/_layout.tsx` — root `Stack` registering the three top-level groups plus the two
  global modals. **Does not yet gate which group renders** on auth/onboarding state
  (`(auth)` vs `(onboarding)` vs `(protected)` are all registered as plain `Stack.Screen`s
  right now) — that redirect logic is a TODO left for when the auth feature is built.
  Wraps the tree in `GestureHandlerRootView` → `ConvexAuthProvider` → `HeroUINativeProvider`
  → navigation `ThemeProvider`.
- `app/(auth)/index.tsx` — login/register (Convex Auth Password provider). No link to
  the admin app.
- `app/(onboarding)/index.tsx` — shown when authenticated but no semester is published.
- `app/(protected)/_layout.tsx` — `Stack` wrapping `(tabs)` plus two pushed screens:
  `activity/[entityId]` and `reminder-timing/[priority]`.
- `app/(protected)/(tabs)/_layout.tsx` — the four real tabs (Home, Calendar, Alerts,
  Settings) via `expo-router`'s `Tabs`, plus a floating action button absolutely
  positioned over the tab bar. **The FAB is not a `Tabs.Screen`** — it always pushes
  `/add-activity` as a modal and never carries active/selected state; don't try to wire
  it into the tab navigator's own state.
- `app/add-activity.tsx`, `app/edit-activity/[entityId].tsx` — root-level modals
  (`presentation: "modal"`), reachable from anywhere via the FAB or an edit action.

### Styling

Tailwind v4 via `uniwind` (Metro plugin in `metro.config.js`, wraps `expo/metro-config`).
`global.css` imports `tailwindcss`, `uniwind`, and `heroui-native/styles` (which defines
the semantic tokens referenced in `AGENTS.md`) plus a `@source` pointing at
`heroui-native`'s compiled lib so its own class usage gets picked up. Imported once, from
`app/_layout.tsx`. Style with `className`, not `StyleSheet.create`.

### Backend (`convex/`)

`schema.ts` is the single source of truth (also consumed, copied, by the separate admin
repo — see `AGENTS.md`). Auth tables come from `@convex-dev/auth`'s `authTables`.
Function files are one per entity (`semesters.ts`, `courses.ts`, `courseActivities.ts`,
`personalTasks.ts`, `reminders.ts`, `alerts.ts`) and are currently minimal stubs — real
authorization (scoping to `ctx.auth.getUserIdentity()` instead of a passed-in
`studentId`) is a TODO called out inline in `courseActivities.ts` and
`personalTasks.ts`, deferred until the auth flow is actually wired up.

### `lib/`

- `env.ts` — reads/validates `EXPO_PUBLIC_CONVEX_URL`, throws with a pointer to
  `npx convex dev` if missing.
- `convexClient.ts` — the `ConvexReactClient` instance plus the `expo-secure-store`
  storage adapter passed to `ConvexAuthProvider`.
- `offlineStore.ts` — placeholder only; the offline cache/outbox/alerts-read-state
  described in `AGENTS.md` isn't implemented yet.

### Components

`components/ui/` holds thin generic wrappers (existing `icon-symbol.tsx` /
`icon-symbol.ios.tsx` map SF-Symbol-style names to Material Icons on Android/web — add
new names to the `MAPPING` object in the `.tsx` fallback when you introduce one).
`components/shared/` and `components/features/*` from the target folder structure don't
exist yet — create them as each feature is actually built, not preemptively.

The pre-existing template pieces (`themed-text.tsx`, `themed-view.tsx`,
`use-theme-color.ts`, `constants/theme.ts`'s `Colors`/`Fonts`) are still present but now
orphaned — the new screens style via Tailwind `className` + semantic tokens instead.
Left in place rather than deleted since removing them is a judgment call about the
theming migration, not a scaffolding decision; take them out once nothing references
them.

## Open questions (flagged, not silently resolved)

- **`global.css` didn't already exist** when this scaffold was written, despite being
  described as already present with tokens defined. Created here with the standard
  `heroui-native` + Uniwind imports (see Styling above), which does define the semantic
  tokens named in `AGENTS.md` — but if a different/custom token set was intended, it
  hasn't been applied yet.
- **Where per-priority reminder interval preferences live** (surfaced in Settings and
  edited via `reminder-timing/[priority]`) isn't in the schema — it's not one of the six
  domain entities. Candidates: a field on `Reminder`, a new `reminderPreferences` table,
  or a local-only (AsyncStorage) setting. Not decided; `reminders.ts` doesn't model it.
- **Course `schedule` shape** on the `courses` table is `v.optional(v.any())` — the
  wireframes hadn't specified recurring-schedule fields at scaffold time.
- **Whether the admin app needs write mutations** on `semesters`/`courses`/
  `semesterActivities` from this shared Convex deployment (vs. writing through some other
  path) is unresolved — this app currently only exposes read queries for those three
  tables.
