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

- **`AUTH_RESEND_KEY`** Convex env var — set via `npx convex env set AUTH_RESEND_KEY
  <key>`. Without it, `signIn(..., { flow: "signUp" })` creates the account but throws
  on the verification-email send (`Missing API key`), surfaced to the user as a generic
  "Something went wrong" — expected until this is set, not a bug to route around.

`npx convex dev`, `npx @convex-dev/auth` (JWT signing keys), and the first `npx expo
start` (which generates `uniwind-types.d.ts`/`expo-env.d.ts`) have all been run — no
longer pending.

## Architecture

### Routing (`app/`, Expo Router, typed routes on)

- `app/_layout.tsx` — root `Stack`. Which top-level group is reachable is gated by
  `Stack.Protected guard={...}`, driven entirely by `hooks/use-auth-gate.ts` (see
  "Onboarding gate" below) — not per-screen checks. Renders nothing (native splash stays
  up via `expo-splash-screen`'s `preventAutoHideAsync`) until the gate resolves past
  `loading`, then plays a brief `SplashReveal` animation. Wraps the tree in
  `GestureHandlerRootView` → `ConvexAuthProvider` → `HeroUINativeProvider` → navigation
  `ThemeProvider`.
- `app/(auth)/` — `index.tsx` (login/register tabs, no link to the admin app),
  `verify-email.tsx`, `forgot-password.tsx` (interface-only, deliberately not wired to
  the backend — see Comment policy example below). `_layout.tsx` additionally redirects
  to `verify-email` when the gate says `unverified`, since `Stack.Protected` only gates
  group-level reachability, not which screen within the group.
- `app/(onboarding)/` — `profile-setup.tsx` (cascading Faculty→Division pickers, see
  AGENTS.md's institutional hierarchy) and `index.tsx` (waiting screen, shown once a
  profile exists but no semester is active yet — "Check now" is reassurance only, the
  `semesters.getActive` subscription already navigates away the instant one goes live).
  `_layout.tsx` redirects to `profile-setup` when the gate says `needsProfile`, mirroring
  `(auth)/_layout.tsx`'s pattern.
- `app/(protected)/_layout.tsx` — `Stack` wrapping `(tabs)` plus two pushed screens:
  `activity/[entityId]` and `reminder-timing/[priority]`.
- `app/(protected)/(tabs)/_layout.tsx` — the four real tabs (Home, Calendar, Alerts,
  Settings) via `expo-router`'s `Tabs`, plus a floating action button absolutely
  positioned over the tab bar. **The FAB is not a `Tabs.Screen`** — it always pushes
  `/add-activity` as a modal and never carries active/selected state; don't try to wire
  it into the tab navigator's own state.
- `app/add-activity.tsx`, `app/edit-activity/[entityId].tsx` — root-level modals
  (`presentation: "modal"`), reachable from anywhere via the FAB or an edit action.

### Onboarding gate (`hooks/use-auth-gate.ts`)

One hook owns the entire redirect decision; `app/_layout.tsx` and every group's
`_layout.tsx` read it instead of re-deriving auth/profile/semester state themselves.
Sequence, in order:

1. Logged out → `(auth)` (login/register)
2. Logged in, email unverified → `(auth)/verify-email`
3. Logged in, verified, no `studentProfile` row → `(onboarding)/profile-setup`
4. Logged in, verified, has profile, no active semester → `(onboarding)` (waiting screen)
5. Logged in, verified, has profile, semester active → `(protected)/(tabs)`

`unverified` is defensive rather than reachable in normal use — Convex Auth never
issues session tokens for an unverified Password-provider account, so the real
verify-email redirect happens at the point of the `signIn`/`signUp` call in
`app/(auth)/index.tsx`, not via this gate. Known gap: force-closing the app mid-signup
(after registering, before entering the code) loses your place on reopen, since that
pending state isn't persisted anywhere — not solved, flagged.

### Styling

Tailwind v4 via `uniwind` (Metro plugin in `metro.config.js`, wraps `expo/metro-config`).
`global.css` imports `tailwindcss`, `uniwind`, and `heroui-native/styles` (which defines
the semantic tokens referenced in `AGENTS.md`) plus a `@source` pointing at
`heroui-native`'s compiled lib so its own class usage gets picked up. Imported once, from
`app/_layout.tsx`. Style with `className`, not `StyleSheet.create`.

**Spacing convention** — Tailwind's default 4px-step scale (`gap-4`, `px-6`, ...) is used
directly, not a separate token set like the colors above. The earlier "spacing feels
inconsistent" problem wasn't the scale being inadequate, it was different screens
picking different arbitrary steps for the same kind of gap. Use this table instead of
guessing a number:

| Purpose                                              | Step               |
| ----------------------------------------------------- | ------------------ |
| Screen horizontal padding                             | `16px` (`px-4`) — `SCREEN_HORIZONTAL_PADDING` in `Screen.tsx` |
| Field-to-field gap within a form                      | `gap-4` (16px)      |
| Minor section break (e.g. tab switcher → form)        | `pt-6` (24px)       |
| Major section break (e.g. brand mark → functional UI) | `pb-8` (32px)       |
| Extra emphasis before the primary CTA button          | `pt-2` on top of the normal field gap (24px total) — reinforces that it's the one primary action, not just another list item |
| Icon-to-text padding inside a `TextField`              | `pl-10`/`pr-10` (40px, one icon-width) — see `components/ui/TextField.tsx` |

Label-to-input spacing inside a field is heroui-native's own internal `TextField`
spacing — don't override it per screen.

### Backend (`convex/`)

`schema.ts` is the single source of truth (also consumed, copied, by the separate admin
repo — see `AGENTS.md`). Auth tables come from `@convex-dev/auth`'s `authTables`.

- `auth.config.ts` / `auth.ts` — Password provider with `verify: ResendOTP` (see
  `ResendOTP.ts`) and a `profile()` callback capturing `name` on signup. `reset` is
  deliberately left unconfigured — forgot-password stays interface-only.
- `users.ts` — `viewer` query (current user or null), the auth-gate's first check.
- `academicStructure.ts` — read-only institutional hierarchy queries (Faculty through
  Division), see AGENTS.md.
- `studentProfiles.ts` — `getMyProfile` / `createProfile`, the onboarding-gate table.
- `courses.ts`, `courseSections.ts` — scoped to the caller's `studentProfile
  .academicClassId`, resolved server-side from their auth identity, never trusted from
  a client-passed param.
- `courseActivities.ts`, `personalTasks.ts` — still take an explicit `studentId` param
  rather than deriving it from `ctx.auth` — a real TODO called out inline, deferred
  since no screen calls these mutations yet.
- `seed.ts` — dev-only, idempotent seeding for the institution row and a small test
  academic-hierarchy fixture. Not real KTU data; the admin app owns this data for real
  once it exists.

### `lib/`

- `env.ts` — reads/validates `EXPO_PUBLIC_CONVEX_URL`, throws with a pointer to
  `npx convex dev` if missing.
- `convexClient.ts` — just the `ConvexReactClient` instance.
- `authStorage.ts` — the `expo-secure-store` (web: `localStorage`) adapter passed to
  `ConvexAuthProvider`.
- `authErrors.ts` — maps Convex Auth's terse thrown error strings (`InvalidSecret`,
  `TooManyFailedAttempts`, `Account ... already exists`, ...) to friendly copy. Falls
  back to a generic message by design — plain `Error` messages get redacted to `"Server
  Error"` on production Convex deployments, so specific matches only ever resolve in dev.
- `validation.ts` — `isValidEmail`, a UI-only format check (button-enable gating, not a
  substitute for server-side validation).
- `offlineStore.ts` — placeholder only; the offline cache/outbox/alerts-read-state
  described in `AGENTS.md` isn't implemented yet.

### Components

`components/ui/` holds the shared primitives every screen with inputs/buttons/scroll
should reach for — reinventing any of these per screen is what caused the auth flow's
original inconsistency problems (mismatched keyboard handling, resizing loading
buttons, ad hoc error display):

- `TextField.tsx` — the one text input, wrapping heroui-native's `TextField`/`Input`/
  `Label`/`FieldError` rather than styling from scratch. Label, inline error (border
  color comes free from heroui's `isInvalid` context), left icon slot (`icon` prop —
  add new SF-Symbol-style names to `icon-symbol.tsx`'s `MAPPING` as needed, e.g.
  `envelope`/`lock`/`checkmark.circle.fill`/`party.popper`), password-visibility toggle
  (`secureTextEntry` prop).
- `Button.tsx` — the one submit button, wrapping heroui-native's `Button`. Fixed width
  (defaults to full-width), `isLoading` + `loadingLabel` swap content in place without
  resizing. **Don't use heroui's `isIconOnly` for a loading state** — that collapses the
  button to a square and was the actual cause of the old "buttons jump when loading"
  bug; swap the label/spinner inside the normal-shaped button instead.
- `KeyboardAwareScreen.tsx` — wraps `Screen` with `react-native-keyboard-controller`'s
  `KeyboardAwareScrollView` (current Expo-recommended replacement for bare
  `KeyboardAvoidingView`, which is inconsistent on Android) plus a tap-to-dismiss
  `Pressable`. Needs `KeyboardProvider` at the root (already wrapped in
  `app/_layout.tsx`) and `android.softwareKeyboardLayoutMode: "resize"` in `app.json`.
  Use this instead of `Screen` for any screen with text inputs.
- `icon-symbol.tsx` / `icon-symbol.ios.tsx` — map SF-Symbol-style names to Material
  Icons on Android/web; add new names to the `MAPPING` object in the `.tsx` fallback
  when you introduce one.

`hooks/use-app-toast.ts` — `useAppToast()`, a thin wrapper over heroui-native's own
`useToast()` (its `ToastProvider` already comes from `HeroUINativeProvider`, no separate
setup). `showSuccess`/`showError`/`showWarning` map onto heroui's `success`/`danger`/
`warning` variants. Toast is for action-level outcomes (login/signup/verification
failures, rate limits, "code sent" confirmations); per-field validation (wrong format,
passwords don't match) stays inline on the `TextField` itself — don't mix the two up.

`components/shared/` has `AppTopBar.tsx`, `AppTabBar.tsx`, and `SplashReveal.tsx` (the
root layout's post-splash mark animation). `components/features/auth/` (`AuthHeader` —
icon-only, no wordmark/subtitle) and `components/features/onboarding/`
(`HierarchyPicker`, the cascading-select used on Profile Setup, with a resolved-state
checkmark per step) are built; `activity-details/`, `activity-form/`, `alerts/`,
`calendar/`, `reminders/`, `settings/` are still empty — create them as each feature is
actually built, not preemptively.

The pre-existing template pieces (`themed-text.tsx`, `themed-view.tsx`,
`use-theme-color.ts`, `constants/theme.ts`'s `Colors`/`Fonts`) are still present but now
orphaned — the new screens style via Tailwind `className` + semantic tokens instead.
Left in place rather than deleted since removing them is a judgment call about the
theming migration, not a scaffolding decision; take them out once nothing references
them.

## Comment policy

Comments explain non-obvious WHY, never restate WHAT the code already says. No
comment-per-line narration, no restating a function name in prose above it, no "//
increment counter" above `i++`. A comment earns its place only if a reader with full
context would still have a question without it (a genuinely non-obvious tradeoff, a
workaround for a known library issue, a deliberate scope decision like the
forgot-password deferral in the auth flow). Default to no comment over a filler one.
This applies to all code going forward in this project, not just wherever it was first
written down.

## Keeping these docs current

At the end of every significant pass (new domain concept, schema change, architecture
shift), update both this file and `AGENTS.md` before declaring the pass done — not just
when explicitly asked. Update the section that's now wrong rather than appending a new
one that contradicts it. If a section describes something as a TODO/not-yet-built and
this pass built it, rewrite that section — don't leave stale TODOs next to the code that
resolved them.

## Open questions (flagged, not silently resolved)

- **`global.css` didn't already exist** when this scaffold was written, despite being
  described as already present with tokens defined. Created here with the standard
  `heroui-native` + Uniwind imports (see Styling above), which does define the semantic
  tokens named in `AGENTS.md` — but if a different/custom token set was intended, it
  hasn't been applied yet.
- **Where per-priority reminder interval preferences live** (surfaced in Settings and
  edited via `reminder-timing/[priority]`) isn't in the schema. Candidates: a field on
  `Reminder`, a new `reminderPreferences` table, or a local-only (AsyncStorage) setting.
  Not decided; `reminders.ts` doesn't model it.
- **Whether the admin app needs write mutations** on `semesters`/`courses`/
  `semesterActivities`/the institutional hierarchy tables from this shared Convex
  deployment (vs. writing through some other path) is unresolved — this app currently
  only exposes read queries for all of them.
