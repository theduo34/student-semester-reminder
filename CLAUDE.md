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
- **Android push credentials (Firebase/FCM V1)** — a real gap this pass surfaced, not
  one the original push task anticipated: as of Expo's current docs, Android push
  through Expo's push service needs a **Firebase project's `google-services.json`**
  (path already wired at `android.googleServicesFile` in `app.json`, but the file
  itself isn't in the repo — drop it in once you have it) **and** a **Firebase service
  account JSON key uploaded to EAS** (`eas credentials` → Android → your build profile
  → Google Service Account → upload the key; needs your own Firebase/Google Cloud
  account, not something this session can do on your behalf). Without both, Android
  push tokens can still register, but Expo's push service will fail to actually deliver
  to Android devices — this blocks the demo path, not just iOS.
- **iOS push credentials (APNs)** — as previously scoped: Apple Developer account
  signup is in progress; nothing to do here until that's issued, see this file's Push
  architecture section.
- **A physical Android device (or emulator) with `adb` visibility** — needed for the
  actual "development build installed, push arrives" test (see Testing below). Not
  present in this session's environment when the push pass was built — the code is
  complete and typechecked, but the on-device delivery test itself has not been run yet
  and needs to happen on your machine.

`npx convex dev`, `npx @convex-dev/auth` (JWT signing keys), the first `npx expo
start` (which generates `uniwind-types.d.ts`/`expo-env.d.ts`), and `eas init` (which
created and linked the `@theduo34/termio` EAS project, `extra.eas.projectId` in
`app.json`) have all been run — no longer pending.

## Deployments

Three Convex deployments exist for this project:

- **dev** (`colorless-shepherd-537`, selected via `.env.local`'s `CONVEX_DEPLOYMENT`) —
  the ongoing-development deployment `npx convex dev` watches and pushes to on every
  save. `npm start`/`npm run android`/`npm run ios`/`npm run web` all talk to this one
  by default.
- **preview** (`groovy-weasel-220`, reference `preview/preview`) — a Convex "preview
  deployment" (`npx convex deployment create preview --type preview`), originally set up
  as the pre-defense demo/testing target. **No longer what `eas.json`'s `preview` build
  profile points at** — Convex's Preview Deployments feature wasn't usable/visible on
  this project's dashboard, so rather than fight that, the demo/build backend was
  consolidated onto the project's actual **production** deployment instead (see below;
  acceptable simplification for a school project, not a real production service with
  real users). This deployment still exists and still has its own JWT keys/env vars, but
  is currently unused by any build profile — not deleted, in case it's wanted again.
- **production** (`grateful-starfish-783`, the project's default Convex production
  deployment — no separate `create` step needed, `npx convex deploy` provisioned it) —
  the actual backend behind `eas.json`'s `preview` build profile (an
  internal-distribution `.apk`, not a Play Store release — the *build profile* name and
  the *Convex deployment* name happen to differ, don't conflate them).
  `EXPO_PUBLIC_CONVEX_URL` is wired in `eas.json` to
  `https://grateful-starfish-783.convex.cloud`. Fully provisioned: `npx convex deploy`
  (schema/functions pushed), `npx @convex-dev/auth --prod` (JWT signing keys —
  deliberately not shared with dev/preview, same reasoning as below), `npx convex env
  get AUTH_RESEND_KEY | npx convex env set AUTH_RESEND_KEY --prod` (the one env var
  that IS shared, see below), and `npx convex run seed:seedAll '{"iAmSure": true}'
  --prod` (demo student `demo@example.com`/`demo1234`, demo admin
  `admin@example.com`/`admin1234` — same credentials as dev, just a separate row on a
  separate deployment) have all been run.
- **JWT signing keys** are per-deployment, deliberately not shared across any of the
  three — a shared JWT keypair would mean a session token minted on one deployment would
  validate on another, which defeats the point of separate deployments.
- **`AUTH_RESEND_KEY`** is the one env var that genuinely is the same value everywhere —
  it's a third-party API key, not deployment-specific state — copied dev → preview via
  `npx convex env get AUTH_RESEND_KEY | npx convex env set AUTH_RESEND_KEY --deployment
  preview/preview`, and dev → production via the `--prod` equivalent above (piped, not
  typed, so the key value never appears in shell history).
- **`EXPO_PUBLIC_CONVEX_URL`** is per-deployment, always — the client only ever talks to
  one deployment at a time. Local dev reads it from `.env.local`; `eas.json`'s
  `development`/`preview` build profiles each set it explicitly under their own `env`
  block, so an EAS cloud build always points at the deployment matching its profile
  without needing `.env.local` to exist inside that build.
- **Switching which deployment a one-off `npx convex` command targets**: default (no
  flags) always follows `.env.local`'s `CONVEX_DEPLOYMENT`, i.e. dev. Pass `--prod`
  (works broadly — `deploy`/`run`/`env`/`dashboard`) to target production, or
  `--env-file .env.preview.local`/`--deployment preview/preview` for the now-unused
  preview deployment — never edit `.env.local` itself for a one-off, that would silently
  redirect `npx convex dev`'s live watcher.
- **The seed script** (`convex/seed.ts`) runs against whichever deployment the command
  targets — `npx convex run seed:seedAll '{"iAmSure": true}'` (dev, default), plus
  `--prod` or `--env-file .env.preview.local` for the other two. Its guard is the
  `iAmSure` confirmation flag, not a deployment-type check — Convex functions have no
  built-in way to ask "am I running on dev, preview, or prod," so the guard is
  deliberately permission-based (a human has to type `iAmSure: true`) rather than
  environment-based. That already makes it work unmodified on all three deployments.

## Architecture

### Routing (`app/`, Expo Router, typed routes on)

- `app/_layout.tsx` — root `Stack`. Which top-level group is reachable is gated by
  `Stack.Protected guard={...}`, driven entirely by `hooks/use-auth-gate.ts` (see
  "Onboarding gate" below) — not per-screen checks. Renders nothing (native splash stays
  up via `expo-splash-screen`'s `preventAutoHideAsync`) until the gate resolves past
  `loading`, then plays a brief `SplashReveal` animation. Wraps the tree in
  `GestureHandlerRootView` → `ConvexAuthProvider` → `HeroUINativeProvider` → navigation
  `ThemeProvider`.
  **Splash → reveal → gate flow**: `RootNavigator` records its own mount time in a ref
  and calls `SplashScreen.hideAsync()` the instant `gate.status` first leaves
  `'loading'`. At that point it also decides whether to play `SplashReveal`: if less
  than 2000ms elapsed since mount, the reveal plays (its own animation runs ~700ms,
  under the 800ms cap); past that, `showReveal` is never set and the app goes straight
  to the resolved route. This is deliberately a one-way check, not a loading gate — a
  slow network already made the student wait past the reveal's own runtime, so playing
  it on top would only add more waiting for nothing (see CLAUDE.md's Comment policy:
  this is the kind of non-obvious tradeoff worth a comment, and there is one at the
  call site).
- `app/(landing)/` — `index.tsx`, a 3-slide carousel (`react-native-reanimated-
  carousel`) shown ONCE per device install, before `(auth)` — see "Onboarding gate"
  below for exactly when. Not per-account: the gate reads a device-local AsyncStorage
  flag (`lib/landingStorage.ts`'s `termio.hasSeenLanding`), not anything tied to the
  signed-in user, so a fresh account on a device that's already seen the carousel skips
  straight to `(auth)`. `lib/landingStorage.ts` exposes this as a tiny external store
  (`subscribeHasSeenLanding`/`getHasSeenLandingSnapshot`, read via `useSyncExternalStore`
  in `use-auth-gate.ts`) rather than plain component state, specifically so that calling
  `markLandingSeen()` on the carousel's last slide flips the gate immediately, in place,
  with no explicit navigation call and no remount — the same way signing out already
  swaps `(protected)` for `(auth)` purely by changing what the gate returns. The
  AsyncStorage read itself is deferred to the first `subscribe` call rather than run at
  module scope — Expo web's static export pre-renders this module on Node during
  SSR, where AsyncStorage's web shim touches `window` and throws; deferring it to a
  client-side `useSyncExternalStore` subscribe keeps the module SSR-safe. Slides:
  Termio's own mark (`mark.png`) on slide 1, token-coloured icon-in-circle compositions
  (same "oversized circle behind an `IconSymbol`" grammar as the Alerts tab's empty
  state) on slides 2–3 — no separate illustration set introduced for this. All three
  slides now share one badge geometry (`SlideIllustration`'s `BADGE_OUTER`/
  `BADGE_INNER` constants): a very-low-opacity accent halo ring behind an
  `accent-soft`-filled circle with a soft shadow, mark/icon centred inside — the mark
  used to float bare with no badge at all, which read as an inconsistent one-off next
  to slides 2–3's circles; this is what fixed that. `Carousel` itself uses
  `mode="parallax"` (a built-in `react-native-reanimated-carousel` layout, not hand-
  rolled motion) for a subtle scale/slide transition between slides, and
  `DotIndicator`'s active dot morphs into a pill via a Reanimated `LinearTransition`
  layout animation rather than a hard colour swap. "Skip" (top-
  right, slides 1–2 only) and slide 3's "Get started" both call `markLandingSeen()`;
  "Next" on slides 1–2 just advances the carousel via its `ICarouselInstance` ref.
- `app/(auth)/` — `index.tsx` (login/register tabs, no link to the admin app),
  `verify-email.tsx`, `forgot-password.tsx` (interface-only, deliberately not wired to
  the backend — see Comment policy example below). `_layout.tsx` additionally redirects
  to `verify-email` when the gate says `unverified`, since `Stack.Protected` only gates
  group-level reachability, not which screen within the group.
- `app/(onboarding)/` — `profile-setup.tsx` (renders
  `components/features/onboarding/AcademicHierarchyForm.tsx` with `startingFrom`
  omitted, i.e. every field editable — see AGENTS.md's Profile editing section; the
  cascade itself is shared with the profile detail screen's academic-edit flow, not
  inline here anymore, plus a one-line "Tell us where you study" intro above it) and
  `index.tsx` (waiting screen, shown once a profile exists but no semester is active yet
  — "Check now" is reassurance only, the `semesters.getActive` subscription already
  navigates away the instant one goes live). The waiting screen's mark sits in the same
  halo-ring badge geometry as the landing carousel's slides (`WaitingBadge`), animated
  with a slow Reanimated pulse (`withRepeat`/`withTiming` on scale + opacity) so the
  screen reads as "actively listening," not a static dead end; "Check now"'s reassurance
  message is a small `success`-tinted pill with a checkmark icon rather than plain text.
  `_layout.tsx` redirects to `profile-setup` when the gate says `needsProfile`, mirroring
  `(auth)/_layout.tsx`'s pattern.
- `app/(protected)/_layout.tsx` — `Stack` wrapping `(tabs)` plus every pushed detail
  screen (`activity/[entityId]`, `settings/reminder-timing/[priority]`,
  `settings/profile`, ...). See "Nested navigation" below — this is the one place all
  of them get registered, never inside `(tabs)`.
- `app/(protected)/(tabs)/_layout.tsx` — the four real tabs (Home, Calendar, Alerts,
  Settings) via `expo-router`'s `Tabs`, plus a floating action button absolutely
  positioned over the tab bar. **The FAB is not a `Tabs.Screen`** — it always pushes
  `/add-activity` as a modal and never carries active/selected state; don't try to wire
  it into the tab navigator's own state. Home and Calendar both render the unified
  activity list (`components/shared/ActivityCard.tsx`) — see the Calendar section
  below. Alerts is fully built (see the Alerts section below) — the FAB here is a
  student-only pattern (quick personal-reminder creation), which is why
  `components/shared/AppTabBar.tsx` takes a `centerAction` prop the admin tab bar
  overrides to `null` rather than this file changing at all — see the Admin route
  group section below.
- `app/(admin)/` — the role-gated admin experience living in this same app (see
  AGENTS.md's Scope boundary and Admin account sections) — not a separate app/repo,
  reached from the same single login screen every student uses. `_layout.tsx` is a bare
  `Stack` wrapping `(tabs)`, mirroring `(protected)/_layout.tsx`'s shape (pushed admin
  detail screens register here as siblings of `(tabs)`, same standing rule as the
  student side's Nested navigation section below — the four Hierarchy drill-down
  screens are the current example). `(tabs)/_layout.tsx` reuses the exact same
  `AppTabBar` the student side uses — same icon+label grammar, same `--accent`
  active-state coloring — just four different routes (Dashboard/Hierarchy/Courses/
  Publish) and `centerAction={null}`: admin has no FAB, since admin's creation actions
  live inside their own tabs (a "New institutional event" button on Publish, a "New
  course" button on Courses, etc.), not behind one shared quick-create button the way
  the student FAB is.
  - **Dashboard** (`(tabs)/index.tsx`) — deliberately styled after student Home, not a
    typical web-admin sidebar+top-title-bar layout: `HomeHeader` (the same component
    Home uses — date + "Hello, {name}" + tappable `Avatar`, reused as-is since its
    props were already generic) as the header, reusing `Avatar`'s tap slot for a
    sign-out `ConfirmDialog` instead of Home's profile-screen navigation (admin has no
    profile detail screen yet). Body: an accent-filled institution/active-semester
    banner (visually matching Home's `ProgressCard` band), a 2×2 stat-tile grid
    (students/faculties/departments/courses) from `api.adminDashboard.getOverview` —
    one aggregate query, not one round-trip per stat, see that file's own comment for
    why every table below `faculties` needs manual scoping — and a students-by-faculty
    breakdown list. Same two-state loading pattern as every other screen (a skeleton
    shaped like the real content while `overview`/`viewer` are `undefined`).
  - **Hierarchy** (`(tabs)/hierarchy/index.tsx` + `app/(admin)/hierarchy/*`) — full
    Faculty→Department→Program→academicClass→Division CRUD, `AppTopBar` (plain title +
    an `AddHeaderButton` "+" action) rather than `HomeHeader`'s greeting style, the same
    way every non-landing-tab screen elsewhere in this app (Calendar, Alerts, Settings)
    uses `AppTopBar` while only Home gets the richer greeting header — Dashboard is
    admin's Home-equivalent, Hierarchy is admin's Calendar-equivalent, not two competing
    header styles. Row actions live behind `HierarchyList`'s "..." `ActionSheet` menu
    (Edit/Delete) rather than a persistent pencil/trash pair — five hierarchy levels'
    worth of rows showing two icons each would be noisier than a menu; Add/Edit reuse
    `EditFieldModal` (every level here is just a name/label), Delete goes through
    `ConfirmDialog` and surfaces the mutation's own blocked-delete message ("still has
    departments", ...) via toast on failure rather than a generic error. Each drill-down
    screen (`hierarchy/faculty/[facultyId]`, `.../department/[departmentId]`, `.../
    program/[programId]`, `.../class/[academicClassId]`) sets its own dynamic
    `Stack.Screen` title (the tapped row's own name) the same way
    `academic-year/index.tsx` does for data `app/(admin)/_layout.tsx`'s static config
    doesn't have.
  - **Courses** and **Publish** (`(tabs)/courses/index.tsx`, `(tabs)/publish/index.tsx`)
    are still `components/shared/PlaceholderScreen.tsx` stand-ins (Screen + AppTopBar +
    centered "___ coming soon" text) — build their CRUD here, following Hierarchy's
    pattern (`requireAdmin`-gated mutations in `convex/`, `AppTopBar` + `AddHeaderButton`
    + `EditFieldModal`/a dedicated form + `ConfirmDialog` on the client), not in a
    separate app.
- `app/add-activity.tsx`, `app/edit-activity/[entityId].tsx` — root-level modals
  (`presentation: "fullScreenModal"`, not the card-inset `"modal"` — these read as their
  own full screen, not a peek at what's behind them; `UIModalPresentationFullScreen` on
  iOS, no swipe-to-dismiss there, closing is the X button only — Android's `"modal"` was
  already effectively full-height, so this is a no-op on that platform), reachable from
  anywhere via the FAB or an edit action. Both are the New/Edit Reminder forms —
  students only ever create personal reminders, so there's no "course activity" tab
  here (see AGENTS.md). Both use `components/shared/ModalHeader.tsx` and
  `components/shared/ReminderForm.tsx`, not `AppTopBar` — see Components below.
- `app/about.tsx`, `app/edit-academic-details.tsx` — two more root-level modals.
  `about.tsx` is display-only (`ModalHeader` with `onSave` omitted). `edit-academic-
  details.tsx` takes a `startingFrom` param and nests a `ConfirmDialog` before saving —
  deliberately a route, not a component rendered inline like `EditFieldModal`: heroui's
  `Dialog` attaches to the app's own native window, which a bare RN `<Modal>` (a
  separate native window) would render *behind*, not above. Route-level modals in this
  app use `react-native-screens`' native modal presentation instead, which composes
  correctly with `Dialog` — proven already by `edit-activity.tsx`'s own delete
  `ConfirmDialog`. `EditFieldModal` never nests a `Dialog`, so it doesn't have this
  problem and stays a plain component — see Components below.

### Nested navigation

Any screen a tab-screen row pushes into (Settings' reminder-timing rows are the first
example; later Dashboard/Calendar/Alerts detail screens follow the same rule) is
registered as a sibling of `(tabs)` in `app/(protected)/_layout.tsx`, never nested
inside the `(tabs)` group — e.g. `app/(protected)/settings/reminder-timing/[priority]/
index.tsx`, not `app/(protected)/(tabs)/settings/reminder-timing/...`. Pushing onto the
parent Stack this way hides the bottom tab bar, gives a platform-native back button/
gesture, and keeps the screen a real Stack entry — all for free, from react-navigation's
native-stack. Don't reach for `tabBarStyle: { display: 'none' }` tricks inside `(tabs)`
to hide the tab bar per-screen; that's flaky across devices. `activity/[entityId]` uses
`AppTopBar` (`headerShown: false`); newer detail screens like `reminder-timing/
[priority]` use the native header instead (`headerShown: true`) so the back gesture and
title placement come from react-navigation directly — native-stack has no cross-platform
title-centering prop, so title alignment follows each OS's own convention rather than
being forced to match. `settings/profile/index` follows the same native-header pattern
(static title set in `app/(protected)/_layout.tsx` this time, no per-screen
`<Stack.Screen>` override needed since it doesn't change).

**Back button styling** — the native platform header (see above) is the standard for
any screen with a back button; `activity/[entityId]` was converted to it during the
Home pass (previously the one screen still on `AppTopBar`'s custom back button) so
`reminder-timing/[priority]`, `settings/profile`, and `activity/[entityId]` all now
share the same OS-rendered back button/gesture/title placement, nothing in app code to
keep in sync between them. `activity/[entityId]`'s three-dot menu (personal reminders
only) rides along via a local `<Stack.Screen options={{ headerRight: ... }} />`
rendered inside the route component itself — the only way to make a native header's
right slot reactive to component state, since the header options registered in
`app/(protected)/_layout.tsx` are static. `AppTopBar`'s own `left="back"`/`left="close"`
(`Pressable` + `IconSymbol`, `chevron.left`/`xmark`) is still used by modals and
`(auth)/verify-email` — those aren't native-stack screens (modals are their own
presentation, verify-email is pre-auth), so there's no native header to convert them
to. Its `Pressable` now dims on press (`opacity: pressed ? 0.4 : 1`) to match the native
button's own tap feedback, since a bare `Pressable` gives no visual response by default.

### Home (`app/(protected)/(tabs)/index.tsx`)

Three time-derived sections — Overdue, Today's schedule, Upcoming this week — merged
from the same three sources Calendar uses (`courseActivities.listForStudent`,
`personalReminders.listMine`, `alerts.listBySemester`), computed relative to a `now`
that's refreshed on screen focus and every 60s while focused (`useFocusEffect` +
`setInterval`) rather than captured once at mount — otherwise "Today" silently goes
stale if the student leaves the app open past midnight. Buckets are non-overlapping,
priority order Overdue > Today > Upcoming: an item due today whose time has already
passed counts as Overdue, not both.

**Section limits** (display rules, not arbitrary — matches the wireframe): Overdue
shows max **1**, Today's schedule max **3**, Upcoming this week max **2**, Classes
today max **3** (`CLASSES_LIMIT`). Past the limit, the section header's count number is
replaced by a "View more →" link (`text-accent`) that deep-links to Calendar with query
params seeding its initial state — see the Calendar section below:

- Overdue → `{ view: 'month' }` (no `date` — the student browses to find it)
- Today's schedule → `{ view: 'month', date: todayKey }`
- Upcoming this week → `{ view: 'week' }`
- Classes today → `{ view: 'month', date: todayKey }`

**Classes today** — a fourth section, above Overdue, sourced from
`courseSections.listMyScheduleForSemester` (see CLAUDE.md's courseSections.ts entry)
rather than the three `UnifiedActivity` sources the others share: recurring class
sessions have no priority/completion/due-date concept, so they're filtered to the
current day-of-week and rendered via `ClassSessionRow` (`components/shared/
ClassSessionRow.tsx`), not `ActivityCard`. `Section` itself is generic
(`Section<T>({ items: T[], renderItem: (item: T) => ReactNode, ... })`) specifically so
this one section can reuse the same count/limit/"View more" chrome as the other three
without forcing class sessions into `ActivityCard`'s shape. `todaysClasses` is computed
via `isWithinSemester` (`lib/courseSchedule.ts`) first — a Saturday before term starts
or after it ends shows no classes, even if a course section's `scheduleDays` includes
it — then filtered to `DAY_NAMES[new Date(now).getDay()]`. Hidden entirely (no header)
when empty, same treatment as Overdue.

**Section empty states** — Overdue and Classes today are the two sections that can
disappear entirely (no header, nothing rendered) when there's nothing to show; Today's
schedule and Upcoming this week always render their header, even when empty, with a
one-line muted placeholder ("Nothing on your plate today." / "No activities coming up
this week.") instead of the section vanishing — so the student can tell the app
checked, not that it silently failed to load. Only when Overdue, Today's schedule,
Upcoming this week, AND Classes today are all empty does the screen swap to
Wireframe_11's full-screen "You're all caught up" state (confetti icon, `Add your first
activity` button pushing `/add-activity` — a second entry point to the same modal the
FAB opens) — `isEverythingEmpty` checks all four, not just the original three, so a day
with classes but no activities shows just the Classes section, never the empty state on
top of it.

`HomeHeader` renders as soon as `viewer` resolves, independent of the three activity
queries — Screen's `header` slot isn't gated behind `isLoading`, so the header (and its
now-tappable `Avatar`, pushing `/settings/profile`) appears immediately while the body
below still shows `HomeSkeleton`.

`ProgressCard` itself (the semester time-elapsed bar) is now wrapped in a `Pressable`
pushing `/academic-year` — see "Academic Year Progress" below. A small "Academic year
progress →" caption + chevron was added inside the card itself (using
`useCSSVariable(['--accent-foreground'])` for the chevron's colour, same pattern as
every other place this app pipes a semantic token into a native icon's `color` prop)
so the card visibly reads as pressable rather than looking identical to before while
silently gaining a tap target.

### Academic Year Progress (`app/(protected)/academic-year/index.tsx`)

Pushed from Home's `ProgressCard` (see above) — registered as a sibling of `(tabs)` in
`app/(protected)/_layout.tsx`, same standing rule every other pushed detail screen
follows (see "Nested navigation" below), native header with a dynamically-set title
(`Stack.Screen options={{ title: view?.title }}`, the semester's own title, set
locally in the route component, same pattern `activity/[entityId]`'s `headerRight`
already uses for data the static per-route config in `_layout.tsx` doesn't have).

**Shows one semester at a time, never both semesters of the academic year at once** —
revised from an earlier version that showed a full academic-year overview by default.
Defaults to the currently active semester (`api.semesters.getActive`, resolved
client-side); the three-dot header menu (`headerRight`, see below) lets the student
browse to any other published semester instead.

**Data**: `api.academicYears.getSemesterOverview({ semesterId })` — see the Backend
section below. `semesterId` is either the student's explicit pick (the three-dot
picker) or, when they haven't picked one, whichever semester `api.semesters.getActive`
currently resolves to (`'skip'`-gated until one of those two is known — see Convex's
documented conditional-query pattern, used the same way elsewhere in this app, e.g.
Calendar). Returns the resolved `academicYears` row (shown as a small caption above the
ring, for context) plus that one semester's `semesterActivities`/`personalReminders`/
`courseActivities`, already scoped to the caller. The screen maps those rows through
the same `lib/activityMapping.ts` mappers Home uses (see `lib/` below), sorts them by
`dueDate`, and renders them via the same `ActivityCard` row every other activity list
in this app uses — no screen-specific row treatment.

**Three-dot menu** (`components/features/academic-year/AcademicPeriodPicker.tsx`) — a
small `Dialog` with a two-step list: every published academic year as a row (tap to
drill into its semesters), then that year's semesters as rows (tap to view, with a
"Current" tag on the active one and a checkmark on whichever is already selected), plus
a "View current semester" shortcut back to the default. Deliberately plain pressable
rows, not heroui's `Select` — an earlier version nested two `Select` popovers inside
the `Dialog` and their popover `Portal`s didn't reliably render on top of the Dialog's
own `Portal` (two competing overlay layers); a flat list avoids that entirely and reads
more like `ActionSheet`'s row-list menu anyway. When viewing a semester that isn't the
active one, a small banner above the progress card offers the same "back to current"
shortcut inline, so switching back doesn't require reopening the menu.

**Layout**, top to bottom: an optional "viewing a different semester" banner, a
`CircularProgress` ring (`components/shared/CircularProgress.tsx`) for that one
semester's completed ÷ total, with the academic year's title as a small caption above
it and a one-line summary below ("N of M activities completed in Semester 1"); the
semester's own card (title + a "Current" pill when active — the same `bg-accent/15` +
`text-accent` pairing used elsewhere for a soft, non-alarming tag — date range, a
time-elapsed bar identical in style to Home's `ProgressCard` via the shared
`lib/semesterProgress.ts#computeSemesterProgress`, and a completed/total count; the
active semester shows "N weeks remaining", a past one shows "N% of term elapsed"
instead since `computeSemesterProgress` already clamps to [0, 100]); then that
semester's activity list.

**Activity list pagination** — renders `ACTIVITIES_PAGE_SIZE` (5) activities at a time
with a "Load N more" button below, rather than the full list at once (a semester with
many activities would otherwise be a very long scroll with no way to gauge length).
Keyed by the semester's own id at the call site so switching semesters resets the
visible count back to 5, not carrying over whatever was expanded on the previous one.

**Completion counting**: only `courseActivities` and `personalReminders` count toward
the semester's completed/total (and the ring) — a `semesterActivity` has no completion
concept (institutional events can't be "done," see AGENTS.md's Priority model), so it's
excluded from both counts but still rendered in the activity list. This is the same
exemption Home's own overdue detection already makes for semester activities, applied
here to completion instead of overdue.

**Empty/missing states**: a full-screen skeleton while resolving the active semester or
loading its overview (shape-matched to the ring + semester card, same `HomeSkeleton`
pattern as Home); "No active semester right now — check back once one is published"
specifically when there's no active semester AND the student hasn't picked one of their
own (`api.semesters.getActive` resolves `null`); a softer "That semester hasn't been
published, or has nothing to show yet" for an explicitly-picked semester that no longer
resolves (predates `academicYearId`, or was since unpublished) — distinct messages
because the first is a normal "nothing active yet" state and the second is closer to a
stale selection, not a broken app either way.

### Calendar (`app/(protected)/(tabs)/calendar/index.tsx`)

Accepts optional `date` (`YYYY-MM-DD`, the app-wide `toDateKey` format) and `view`
(`"month" | "week"`) query params for external deep-linking — Home's "View all" links
are the first caller. Two `useEffect`s (not a `useState` initializer) apply them
whenever present, because Expo Router's tab navigator keeps this screen mounted across
tab switches — a second navigation here with different params while already mounted
wouldn't re-run an initializer, only an effect watching the param values. Absent params
leave whatever's already selected untouched (today / month, or wherever the student
last left it).

`react-native-calendars` (Wix) is the one calendar UI library for this project — see
AGENTS.md. Month view is `<Calendar/>`; Week view is `<WeekCalendar/>`, which requires a
`<CalendarProvider date={...} onDateChanged={...}>` ancestor. Both views live inside the
*same* `CalendarProvider`, toggled via a plain `useState<'month'|'week'>` that swaps
which leaf renders — `Calendar` doesn't actually need the provider's context, but
sharing it means toggling view mode never unmounts/remounts a whole different tree
(no flicker, selected day survives the switch). The package doesn't re-export its
`Theme`/`MarkedDates` types from its root (only from a deep `src/types` import) —
declared as small local structural types in the screen file instead of reaching into
the library's internals; the real `Calendar`/`WeekCalendar` prop types still
structurally check them at the JSX call site.

**Marked dates use two colour systems, deliberately not the same one:**

- **Calendar's day-cell dots** (`markingType="multi-dot"`) use a 4-bucket scheme —
  Critical / Important / Flexible / Personal — where *every* personal reminder buckets
  as "Personal" regardless of its own priority field, and course activities/semester
  activities bucket by their actual priority tier (semester activities are always
  "Critical" — that's a domain rule, not a stored field, see AGENTS.md). One dot per
  distinct bucket present on a day, deduplicated — three Important assignments due the
  same day still show a single Important dot, not three. A legend row under the grid
  (`LEGEND_ITEMS`) explains what each colour means.
- **`ActivityCard` rows in the agenda** below the calendar use their own existing
  per-row rule unchanged (course colour when tied to a course, `--personal` when not,
  `--critical` for a semester activity specifically since it can never have a course
  colour but must never read as personal-purple either).

Don't try to unify these two into one rule — they answer different questions (which
priority buckets does this day have activity in? vs. what colour is this one row?) and
forcing them to match would make one of the two wrong.

**Today vs. selected are two different visual treatments, not the same accent shown
twice — and both are square, not circular.** The library's own `today`/`selected`
day-cell props default to a `borderRadius: 16` circle; that's overridden via the
`theme['stylesheet.day.basic']` style key (a flat literal-string key, not a nested
`stylesheet.day.basic` path — see the override-key inconsistency note below) rather
than a custom `dayComponent`, since the default `BasicDay` already correctly composes
dot-marking/disabled/inactive/accessibility state and reimplementing all of that was
higher-risk than restyling the two sub-objects the library already exposes for this:

- **Today** (whether selected or not) — the *stronger* style: a filled `--accent` box,
  text in `--accent-foreground`, corner radius `--radius-md`.
- **Selected, not today** — the *lighter* style: a low-opacity `--accent` tint box
  (`useThemeColor('accent-soft')`, heroui's hook; `--accent-soft` only exists as a
  derived `--color-accent-soft` `color-mix()` token, not a raw custom property in
  global.css, so the plain `useCSSVariable(['--accent-soft'])` pattern used for the
  other colours here wouldn't resolve it), text stays `--foreground`, same
  `--radius-md` corner radius.
- **Today + selected at once** — today's stronger style wins, no third mixed state.
  Achieved without a custom `dayComponent`: `markedDates` simply never sets
  `selected: true` on the entry for `todayKey`, since the library's own `BasicDay`
  already checks `if (isSelected) {...} else if (isToday) {...}` — omitting the
  `selected` flag on that one day is enough to fall through to the `today` branch.
- **Regular day** (neither) — no background, just text.
- Multi-dot marking coexists with both box states — dots render below the day number,
  inside the box when one applies, and are never hidden by the highlight.

The calendar body itself is intentionally not wrapped in a bordered/rounded
container — it renders edge-to-edge against the screen background, not as a boxed-in
card.

**Override-key inconsistency (undocumented, unstable internal surface — verified by
reading the library's `.js` source, not its `.d.ts`):** most style overrides
(`calendar/style.js`, `calendar/header/style.js`, `calendar/day/basic/style.js`) read
via flat literal-string keys with dots in them —
`theme['stylesheet.calendar.main']`, `theme['stylesheet.calendar.header']`,
`theme['stylesheet.day.basic']` — but `expandableCalendar/style.js` (governs
`WeekCalendar`'s week-strip row) reads via a genuinely nested path,
`theme?.stylesheet?.expandable?.main`. The exported `Theme` type claims a uniformly
nested shape; it's wrong. Get this backwards and the override silently no-ops instead
of erroring. Also: these overrides are shallow replacements of the named sub-key, not
deep merges — omit a property (e.g. `backgroundColor`) when overriding `today`/
`selected`/`container`/`header`/`week` and it's gone, not inherited from the default.

**Zero additional horizontal padding** — the month grid, month header, and
`WeekCalendar`'s week-strip row all ship with their own internal horizontal padding
(5px/10px/15px respectively, found by reading the same source files above); all three
are zeroed via the style overrides so the calendar's day columns land on the exact
same left/right edges as the rest of the screen's content. See Styling's "no
additional horizontal padding on nested content" rule below — this is that rule's
original motivating case, alongside reminder-timing.

**Data**: `courseActivities.listForStudent` + `personalReminders.listMine` +
`alerts.listBySemester` (semester activities — yes, that query lives in `alerts.ts`,
not a separate `semesterActivities.ts`, see the Backend section) are merged
client-side into one array, then bucketed into a `Map<dateKey, activity[]>` via the
shared `lib/dateKey.ts#toDateKey` helper (local-timezone `YYYY-MM-DD` built from date
components — see "Date-key convention" under Styling below). Bucketing reads each
entity's canonical calendar-day field, not necessarily the field shown on the agenda
row: `courseActivities`/`semesterActivities` have only one date field each
(`dueDate`/`date`), but `personalReminders` has two — `dueDate` (the day it's for,
used for bucketing) and `startTime` (when the notification fires, used for the
agenda row's displayed time). Historically these were edited via two independent,
uncorrelated pickers and could diverge in both day and time-of-day — that was a real
bug, not just for Calendar's own bucketing (a personal reminder due on day N with a
`startTime` that rolled into day N+1 silently vanished from day N's agenda) but for
Home/Alerts' overdue detection too: `dueDate`'s leftover time-of-day (whatever moment
the form happened to be open at) could already be in the past by save time, so a
reminder due later *today* was immediately misread as overdue. Fixed at the source —
`ReminderForm`'s Date field now re-stamps its year/month/day onto `startTime`/`endTime`
whenever it changes (`withDay`), and both `app/add-activity.tsx` and
`app/edit-activity/[entityId].tsx` send `dueDate: values.startTime.getTime()` (same
instant as `startTime`, not the Date field's own raw value) — so for personalReminders
`dueDate` and `startTime` are now always the same instant, and every consumer that reads
`dueDate` as the authoritative deadline (`ActivityCard`'s overdue calc, the overdue
cron, `useAlertsSync`'s client fallback) gets an accurate value without needing its own
special case. The dueDate/displayTime split described below (bucket by `dueDate`,
display by `displayTime`, never conflate the two) is still the right pattern and still
in place — it's just no longer masking a data bug, since the two fields no longer
diverge. Both the bucketed
map and the `markedDates` object derived from it are `useMemo`'d off the same query
results — recomputing `markedDates` on every render is a known performance sink
specific to this library (see AGENTS.md's general version of this rule). Selecting a
day just reads `activitiesByDay.get(selectedDate)` for the agenda list below — no
separate "scroll to this day" logic, since the agenda is a filtered view for one day,
not a running list.

### Alerts (`app/(protected)/(tabs)/alerts/index.tsx`)

See AGENTS.md's Alerts feed section for the three kinds and where each gets created
(`hooks/useAlertsSync.ts`, wired once at `app/_layout.tsx`'s `RootNavigator` — not
per-screen). This section covers the screen/component side.

**Time buckets** — `bucketAlerts` groups `api.alerts.listMine`'s results by `createdAt`:
Today (`>= start of today`), Yesterday (`>= start of yesterday, < today`), This week
(`>= 7 days back, < yesterday`), Earlier (everything else). A bucket with zero alerts
is dropped from the rendered list entirely — never an empty section header sitting
above nothing. `startOfLocalDay`-anchored boundaries, same local-timezone convention as
`lib/dateKey.ts#toDateKey` elsewhere, just not routed through that specific helper
since it needs day *boundaries* here, not a lookup key.

**`AlertCard`** (`components/features/alerts/AlertCard.tsx`) — same square icon-well
shape as `ActivityCard`, coloured by kind: `REMINDER_FIRED` uses the alert's own frozen
`priority` field (same priority-token pairing as `ActivityCard`/`PriorityBadge`);
`NEW_EVENT` is a fixed accent tint (institutional news reads as neutral-good, not a
priority level); `OVERDUE` is always critical. Unread state: `border-accent/25` +
`bg-accent/5` tint plus a small solid accent dot at the top-right corner; read state is
the plain `border-border`/`bg-surface` card every other surface in this app uses.
Swipe-left-to-reveal-delete via `react-native-gesture-handler`'s `Swipeable` (already a
project dependency — no new library installed for this) with `onSwipeableOpen` doubling
as the "swipe past threshold auto-deletes" behavior; the revealed action button covers
the "didn't swipe far enough, tap to confirm" case. No `ConfirmDialog` for this single-
item delete — see AGENTS.md's standing rule on that. Wrapped in `Animated.View` with a
`FadeOut` exit so a deleted card animates away instead of just vanishing.

**Header** — `AppTopBar`'s `right` slot took two side-by-side items here ("Mark all
read" text link + the three-dot menu) for the first time; no change to `AppTopBar`
itself was needed — `right` already accepts arbitrary `ReactNode`, so the screen just
passes a `flex-row` `View` wrapping both. "Mark all read" stays visible (not hidden)
and just dims/disables when there are zero unread alerts, rather than shifting the
header's layout depending on state. The three-dot menu (`ActionSheet`, reused from
Activity Details) holds "Clear all alerts" — the one action here that *does* go through
`ConfirmDialog`, since it's bulk and irreversible.

**Empty state** — soft `accent-soft` circle behind a bell icon, "You're all up to
date," no CTA (there's nothing for the student to do to produce alerts — a good state,
not a dead end). Shown only when `listMine` returns zero rows.

### Push architecture (Android + iOS, cross-platform code)

Real Expo push covers exactly two of the Alerts feed's three kinds — `NEW_EVENT` and
`OVERDUE` — though `NEW_EVENT` only pushes for its semesterActivities half
(`notifyNewEvent`, triggered on insert); the courseActivities half (an exam/assignment/
quiz/project publish) has no server-side push counterpart yet and only ever produces an
Alerts-tab row via `useAlertsSync`'s client-side detection — see AGENTS.md's Alerts feed
section. `REMINDER_FIRED` stays purely local (an on-device `expo-notifications`
schedule — not yet actually implemented, see the Alerts feed section's flagged gap
above) and never goes through this pipeline; pushing it too would double-fire
alongside the eventual local notification for the same trigger.

**Client — token lifecycle** (`lib/pushNotifications.ts` + `hooks/
usePushRegistration.ts`):
- `usePushRegistration()`, called once from `app/_layout.tsx`'s `RootNavigator`
  (alongside `useAlertsSync`/`useNotificationObserver`), registers this device's token
  once auth resolves and re-registers on the rare token-rotation event
  (`Notifications.addPushTokenListener`).
- `lib/pushNotifications.ts` owns permission handling (respects a denial —
  `termio.pushPermissionDenied` in AsyncStorage — rather than re-prompting every
  launch), Android notification channel registration (`critical`/`important`/
  `flexible`, mirroring the app's priority tiers rather than an activity-type grouping
  — the same channel vocabulary local reminder-fired scheduling will register against
  once it's built), and the actual `Notifications.getExpoPushTokenAsync({projectId})`
  call (`projectId` from `Constants.expoConfig.extra.eas.projectId`, set by `eas
  init`). Every function here runs identically on iOS and Android — no `Platform.OS`
  branch in the logic itself, just one up-front `isPushCapablePlatform()` boundary
  check (push isn't meaningful on web).
- Registration calls `api.pushTokens.registerPushToken` directly via the shared
  `convex` client (`convex.mutation(...)`), not `useMutation` — this also needs to run
  from the token-rotation listener's callback and (for unregister) from the logout
  flow, neither of which are inside a component's render.
- **Logout** calls `lib/pushNotifications.ts#unregisterCurrentDeviceToken()`
  explicitly, *before* `signOut()` (see Settings' logout `ConfirmDialog`) —
  `unregisterPushToken` is an authenticated mutation, so it has to run while the
  session is still valid, not react to it having already cleared. That's why it's an
  explicit call at the call site, not a `useEffect` cleanup keyed on auth state.

**Schema** — `pushTokens` (`userId`, `token`, `platform: "ios"|"android"`,
`updatedAt`), indexed by `userId` and by the compound `(userId, token)` upsert key. One
row per (student, device) — logging in on a second device adds a second row rather than
overwriting the first.

**Backend — delivery** (`convex/pushDelivery.ts`, all `internalAction`, never
client-callable):
- `sendPushToUser` — the general single-user send. Looks up all of that user's
  `pushTokens` (via `pushTokens.listForUser`, an `internalQuery`), POSTs to
  `https://exp.host/--/api/v2/push/send`, and prunes any token Expo reports as
  `DeviceNotRegistered` (`pushTokens.removeToken`). Never throws on a partial or total
  failure — a dead token or an unreachable Expo endpoint shouldn't fail whatever
  triggered the send, since the Alerts row it accompanies is already durable regardless
  (see below).
- `notifyNewEvent` — fans a new `semesterActivity` out to every student (see
  `studentProfiles.listAllUserIds`'s single-institution scoping caveat — there's no
  `institutionId` on `semesters`/`studentProfiles` to narrow by yet).
- `convex/overdueSweep.ts` — the overdue cron's sweep logic, calling the same
  underlying `deliverToUser` helper that `pushDelivery.ts` exports.

**Trigger points**:
- **`new_event`** — wherever a `semesterActivity` is actually inserted schedules
  `pushDelivery.notifyNewEvent` via `ctx.scheduler.runAfter(0, ...)` (mutations can't
  make the external HTTP call a push send needs; only actions can). Today that's only
  `convex/seed.ts#upsertSemesterActivity` — the `(admin)` Publish tab (see the Admin
  route group section above) is still a placeholder as of this pass, not a real
  publishing UI yet — so **re-running the seed against the preview deployment is still
  the actual defense-demo path for push** until Publish is built: it delivers a real
  push to whatever device has a `pushTokens` row for the demo student, not just an
  Alerts-tab row.
- **`overdue`** — `convex/crons.ts` runs `overdueSweep.run` every 15 minutes: a
  full-table scan of `courseActivities`/`personalReminders` (flagged as a real scaling
  limit in both `listOverduePending` queries — fine at this app's demo scale, not
  something that'd hold up at real scale) for `PENDING`/not-completed rows past their
  due date, logging + pushing each one. **`hooks/useAlertsSync.ts`'s client-side
  overdue check is NOT removed** — it stays as a fallback so the Alerts feed still
  fills in between cron runs (or if the cron is ever paused), and it can never
  double-alert against the cron: both paths go through `alerts.createForUser`'s dedup
  on `(userId, entityId, kind)` (`alerts.ts`'s shared `upsertAlert` helper), and only
  the write that's actually new (`created: true`) triggers a push — whichever of the
  two gets there first is the one that counts.
- **`reminder_fired`** — no push, ever, by design. See the note at the top of this
  section.

**Tap handling** — `hooks/use-notification-observer.ts`'s
`addNotificationResponseReceivedListener` handles local and push notifications
identically (same `{entityType, entityId}` data shape either way, see
`lib/entityRouting.ts`'s shared `ENTITY_TYPE_TO_ROUTE_TYPE`): marks the matching Alerts
row read (`alerts.markReadByEntity` — the tap payload only carries `entityType`/
`entityId`, not the alert's own `_id`, so this looks it up the same way `alerts.create`'s
own dedup check does; the alert's `kind` is derived from `entityType` since this app's
only two push-able kinds map 1:1 to entity type today — flagged in the file itself if
that ever stops being true) and navigates to Activity Details. `app/_layout.tsx` and
`hooks/use-auth-gate.ts` both separately read
`Notifications.useLastNotificationResponse()` to skip the splash reveal animation and
the `(landing)` carousel gate respectively when the app was opened via a tapped
notification — "notifications go directly into the app" beats either piece of
first-launch polish.

**Testing surfaces**: push cannot be exercised in Expo Go (`npm start`'s default
target) — a development build (`eas build --profile development --platform android`)
or a preview build (`eas build --profile preview --platform android` — `eas.json`'s
`preview` profile builds an `.apk` specifically, not an `.aab`, for easy sideloading)
are the only two surfaces that receive real push. iOS build profiles exist in
`eas.json` (simulator builds, which don't need Apple Developer signing) but a real push
test needs a physical iOS device and APNs credentials, neither of which exist yet —
see "Setup still required" above. Android push additionally needs Firebase/FCM V1
credentials provisioned (also listed there) before any build's push will actually
deliver, even though the token-registration code path works without them.

### Onboarding gate (`hooks/use-auth-gate.ts`)

One hook owns the entire redirect decision; `app/_layout.tsx` and every group's
`_layout.tsx` read it instead of re-deriving auth/profile/semester state themselves.
Sequence, in order:

1. Device hasn't seen the `(landing)` carousel yet AND logged out → `(landing)`
2. Logged out (device has seen `(landing)`, or never gets there because it's already
   logged in — see below) → `(auth)` (login/register)
3. Logged in, email unverified → `(auth)/verify-email`
4. Logged in, verified, `role === 'admin'` → `(admin)/(tabs)`
5. Logged in, verified, `role === 'student'`, no `studentProfile` row →
   `(onboarding)/profile-setup`
6. Logged in, verified, `role === 'student'`, has profile, no active semester →
   `(onboarding)` (waiting screen)
7. Logged in, verified, `role === 'student'`, has profile, semester active →
   `(protected)/(tabs)`

Step 4 (the role check) runs *before* step 5's `studentProfile` check, deliberately —
an admin has no `studentProfile` row at all, and checking profile/semester first would
send every admin into `profile-setup` on every login. Role is stable once set (see
AGENTS.md's Admin account section: it's decided once, at account-creation time, and
nothing in this app ever changes it after), so this is a cheap, one-time branch — the
`studentProfile`/`semesters.getActive` queries are also skipped entirely for admins
(`isStudent` gates both `useQuery` calls to `'skip'`), not just ignored after fetching,
since they're guaranteed pointless for a role that has neither.

Step 1 only ever intercepts the logged-out branch — a logged-in session never gets
routed to `(landing)`, regardless of whether that device's flag happens to be unset
(in practice this can't really happen: a session implies a prior successful login,
which implies the device already passed through here once). `hasSeenLanding` is read
via `useSyncExternalStore` (see `app/(landing)/`'s bullet above), not local state, so
the gate re-evaluates the instant the carousel marks itself seen — no reload needed,
same as any other gate transition.

**One app, one login, role-gated route groups — settled after two reversals.** A prior
pass briefly split admin out into its own web app repo (`termio-admin`) and blocked
`role === 'admin'` from reaching `(admin)/(tabs)` on mobile at all (routing it to a
now-deleted `admin-blocked` screen instead). That split is reverted — see AGENTS.md's
Scope boundary for the full history. There is one Expo app, reachable on any platform
Expo builds for, one login screen (`app/(auth)/index.tsx`, no role picker, no separate
admin sign-in form), and the gate above is the only thing that decides which
experience a session lands in. Nothing about `role` itself changed (still set once, at
account-creation time, see AGENTS.md's Admin account section) — this only changed
which route group a mobile session with `role === 'admin'` is allowed to reach.

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

**No additional horizontal padding on nested content** — `Screen`'s
`SCREEN_HORIZONTAL_PADDING` (16px) is the *only* source of horizontal screen padding.
Nothing rendered inside `Screen`'s children may add its own `px-*`/`mx-*`/horizontal
inset — that stacks a second 16px on top and produces visibly uneven margins. This has
now recurred twice from the same mistake (the reminder-timing screen, and the
Calendar screen's month/week grids and legend row, which additionally had to zero out
`react-native-calendars`' own internal horizontal padding via style overrides — see
the Calendar section above) — treat it as a standing rule, not a one-off fix: when a
third-party component ships its own horizontal insets, override them to zero rather
than compounding `Screen`'s padding with the component's default.

**Date-key convention** — any screen that maps an epoch-ms timestamp to "which
calendar day is this" (Calendar's today/selected/bucketing, and Home/Alerts once they
need the same thing) uses the shared `toDateKey` helper in `lib/dateKey.ts`, never a
local reimplementation and never `toISOString().split('T')[0]`. `toISOString()` is
UTC — an activity at 11:30 PM local time becomes the next day once converted, so its
key stops matching the day the user (and the calendar grid, which is also keyed off
local time) actually sees it on. `toDateKey` builds `YYYY-MM-DD` from
`getFullYear()`/`getMonth()`/`getDate()` instead, so it's always local. One helper,
reused everywhere this comes up, is what prevents the Calendar bucketing bug (see
above) from silently reappearing on another screen with its own copy of the same
logic.

**Radius convention** — every card/group/modal-container/equivalent rectangular surface
is `rounded-md` (`--radius-md`), applied per call site via `className="rounded-md"`.
heroui-native's `Card`, `ListGroup`, `Dialog.Content`, and `Select.Content` all default
to a much larger `rounded-3xl` (they extend the same `Surface` primitive) — this isn't
overridden globally in CSS, it's applied at every usage; grep `rounded-md` across
`components/` for the pattern before adding a new grouped surface. See AGENTS.md's
Design posture for the full rule and the fully-round exemptions (avatars, pills, FABs,
dot indicators — `app/(landing)/index.tsx`'s `DotIndicator` is the current example).

### Backend (`convex/`)

`schema.ts` is the single source of truth for both the student and admin experiences,
both served from this one app (see `AGENTS.md`'s Scope boundary) — one Convex backend,
one client. Auth tables come from `@convex-dev/auth`'s `authTables`,
extended (not replaced) with `role` and `institutionId` on `users` — the documented
`@convex-dev/auth` pattern (`defineTable({ ...authTables.users.validator.fields,
role: ..., institutionId: ... })`, re-declaring the `email`/`phone` indexes) rather
than a parallel `adminProfiles` table. See AGENTS.md's Admin account section for why.

- `auth.config.ts` / `auth.ts` — Password provider with `verify: ResendOTP` (see
  `ResendOTP.ts`) and a `profile()` callback capturing `name` and setting
  `role: 'student' as const` on every signup — the register flow is the only place a
  student account is ever created, and it's the only place `role` is ever `'student'`
  by a path other than `convex/admins.ts`. `reset` is deliberately left unconfigured —
  forgot-password stays interface-only for students (see the auth pass); admins have a
  completely different, non-self-service reset path, see `admins.ts` below.
  Signup is NOT gated by email domain — any email can register, `profile()` doesn't
  inspect it. `convexAuth()`'s top-level `callbacks.afterUserCreatedOrUpdated` (same
  file) does an opportunistic `institutionId` resolution against the real
  `institutions` table — matches the signup email's domain directly against that
  table's `emailDomain` rows and patches `institutionId` only when one matches, leaving
  it unset otherwise (not an error). Split out from `profile()` because that callback
  runs synchronously with no database access, while this one gets a real mutation ctx
  and only ever fires for a brand-new credentials signup (never signIn). See AGENTS.md's
  "Signup email-domain matching" section for the full flow.
- `users.ts` — `viewer` query (current user or null, including `role`/`institutionId`
  since it returns the full row), the auth-gate's first check; `updateName` — the one
  field the profile detail screen edits on the auth `users` table rather than
  `studentProfiles`; `findUserIdByEmail` (`internalQuery`) — shared by `seed.ts` and
  `admins.ts`, both of which need "does a user with this email already exist" before
  deciding whether to create or reuse/reset an account.
- `admins.ts` — `createAdminAccount`, an `internalAction` (not `internalMutation` —
  `@convex-dev/auth`'s `createAccount`/`modifyAccountCredentials` both require action
  context for their credential-hashing pipeline, the same one
  `signIn(..., { flow: "signUp" })` uses from the client; either function kind is
  equally unreachable from the mobile app, which is the actual security property here).
  Runnable only from the Convex dashboard/CLI — see README.md's "Admin accounts"
  section for the exact commands. Creates the auth account with `role: 'admin'`,
  `institutionId`, and `emailVerificationTime` all set directly in the `profile` object
  passed to `createAccount` (no separate patch mutation needed — they're plain fields
  on the same `users` row `createAccount` already writes). Re-running it against an
  email that already has an account resets that account's password
  (`modifyAccountCredentials`) and refreshes `name`/`institutionId`
  (`admins.ts#setAdminFields`, an `internalMutation` — actions can't `ctx.db.patch`
  directly) instead of erroring — the entire MVP "forgot admin password" story.
- `academicStructure.ts` — institutional hierarchy (Faculty through Division), see
  AGENTS.md. Read queries (`listFaculties`, ...) are open to any signed-in caller —
  every student needs these for Profile Setup/cascading edits — plus `getFullHierarchy`,
  which resolves an entire profile's faculty/department/academicClass/division ids to
  human-readable names in one call (profile detail screen's ACADEMIC group, the
  cascading edit picker's pre-fill). Writes (`createFaculty`/`updateFaculty`/
  `removeFaculty` and the matching triple for Department/Program/Division, plus
  `createAcademicClass`/`updateAcademicClass`/`removeAcademicClass`) are admin-only,
  gated by `convex/adminAuth.ts#requireAdmin` — the shared guard every future admin
  mutation (Courses, Publish) should reuse rather than a new ad hoc check. Faculty
  creation resolves `institutionId` server-side via `adminAuth.ts#resolveAdminInstitutionId`,
  never client-passed. Create mutations reject a duplicate name/label within the same
  parent (courtesy validation); `academicClasses`' update/remove are blocked outright
  once anything downstream (`divisions`/`courses`/`studentProfiles`) references the row
  — level/session/program are that row's identity, and a guided reassignment flow (like
  `studentProfiles.updateAcademicHierarchy`'s orphan-nulling on the student side) is a
  bigger feature this pass didn't build; blocking is the safe default instead. Two of
  those dependent-checks (`courses`/`studentProfiles` have no index on
  `academicClassId`; `courseSections`/`studentProfiles` have none on `divisionId`) are
  full-table scans — same "fine at this app's demo scale, flagged not fixed" posture as
  `courseActivities.ts`/`personalReminders.ts`'s overdue-sweep queries.
- `academicYears.ts` — `getSemesterOverview({ semesterId })`, the Academic Year
  Progress screen's one query, plus `listAllForSelection` for its three-dot picker.
  Both `ctx.auth`-derived, never a client-passed studentId. `getSemesterOverview`
  resolves the given semester's own `academicYears` row and gathers that one
  semester's semesterActivities/personalReminders/courseActivities for the caller
  (shared with `buildSemesterBreakdown`, a local helper) — courseActivities has no
  `semesterId` of its own (it only inherits one through its course, see schema.ts), so
  this scopes them via that semester's own `courses` rows rather than a direct index
  lookup. Returns `null` when the semester predates the `academicYearId` field (see
  schema.ts) or doesn't resolve to a real academic year. `listAllForSelection` returns
  every academic year with its semesters (id/title/isActive only) for the picker to
  browse — open to any signed-in caller, same posture as `semesters.ts#list`. Which
  semester to actually query is resolved client-side (the student's explicit pick, or
  `semesters.ts#getActive` by default) — this file has no "current" concept of its own
  anymore. See "Academic Year Progress" below for the screen this powers.
- `studentProfiles.ts` — `getMyProfile` / `createProfile`, the onboarding-gate table.
  `createProfile`/`updateInstitutionalEmail`'s shared `requireInstitutionalEmailDomain`
  helper resolves against the CALLER'S OWN `institutionId` (opportunistically set at
  signup, see `auth.ts` above), not "whichever institution happens to be first in the
  table" — and since signup is no longer domain-gated, `institutionId` is commonly
  unset; in that case the helper is a no-op (any institutional email is accepted, there's
  nothing known to validate against) rather than guessing an institution to enforce.
  Also `updatePhoneNumber` / `updateInstitutionalEmail` /
  `updateDivision` (single-field edits, ownership-checked via a shared
  `requireMyProfile` helper) and
  `updateAcademicHierarchy` (the cascading edit — re-validates the whole Faculty→
  Division chain server-side rather than trusting the client sent a self-consistent set
  of ids, unlike `createProfile`, since moving a student to a different academicClass is
  more consequential; also nulls out — never deletes — any `personalReminders.courseId`
  that no longer belongs to the new academicClass. See AGENTS.md's Profile editing
  section for the full picture). `updateLastSeenAlertsAt` is unrelated to profile
  editing — written only by `hooks/useAlertsSync.ts` after each NEW_EVENT sync pass, so
  the next pass only checks semesterActivities/courseActivities published after that
  point.
- `courses.ts` (`listMyCourses`), `courseSections.ts` — scoped to the caller's
  `studentProfile.academicClassId`, resolved server-side from their auth identity, never
  trusted from a client-passed param.
- `courseActivities.ts` — admin-owned data (see AGENTS.md); `listForStudent` still takes
  an explicit `studentId` param rather than deriving it from `ctx.auth` — a real TODO
  called out inline. Its `create`/`update`/`remove` mutations are unauthenticated
  leftovers from before student-vs-admin ownership was settled and aren't called from
  any screen anymore — not removed in this pass, see Open Questions. `updateStatus` is
  the one write a student actually makes against this admin-owned table (Activity
  Details' Mark complete) — unlike its three siblings, it IS `ctx.auth`-derived and
  ownership-checked, the pattern every new per-student mutation follows, not the older
  TODO'd one.
- `activities.ts` — `resolveById`, the Activity Details screen's polymorphic resolver.
  Takes a bare `entityId: string()` (not a typed `v.id(...)`, since the caller doesn't
  know which table it belongs to) and probes courseActivities, semesterActivities, and
  personalReminders in turn via `ctx.db.normalizeId` — the documented Convex API for
  "this id string might belong to one of several tables," which returns `null` instead
  of throwing when it doesn't decode to the table being tried. Ownership-checked per
  kind (course activities and personal reminders resolve to `null`, same as a genuinely
  missing id, if they don't belong to the caller); semester activities have no owner to
  check, they're institution-wide.
- `personalReminders.ts` — `listMine`/`getMine`/`create`/`update`/`remove`/
  `toggleComplete`, all deriving the owner from `getAuthUserId(ctx)`, none accepting a
  `userId`/`studentId` param — the pattern every new per-student mutation in this repo
  should follow going forward (client-side "only your own" is UX, not security; the
  server refusing to touch another student's row is the actual enforcement). `create`
  enforces `dueDate >= today`; `update` doesn't, so a past reminder can still be
  corrected. Both validate `courseId` (when set) against the caller's own
  `academicClassId` before writing — never trust that the client's course dropdown was
  actually populated from the right catalogue.
- `reminders.ts` — `listForStudent`/`record` (still `studentId`-param, same TODO as
  above) plus `getPreferences`/`setPreferences`, which DO derive the student from
  `ctx.auth` (the newer pattern, not the older TODO'd one) — per-priority reminder
  interval arrays in minutes-before-due, read by Settings' reminder-timing rows and the
  `reminder-timing/[priority]` detail screen. A missing row means "use the shipped
  default" (`DEFAULT_INTERVALS_MINUTES`), not "no reminders."
- `notificationPreferences.ts` — one row per student for Settings' push/sound/calendar-
  sync toggles; also `ctx.auth`-derived. A separate table from `reminderPreferences`
  (timing) — don't conflate the two.
- `alerts.ts` — two unrelated things in one file: `listBySemester` (semesterActivities,
  read-only, predates and is independent of everything below — Calendar/Home's own
  merge into their unified activity list, see the Calendar section) and the Alerts
  tab's actual feed CRUD — `listMine`, `create` (called by `hooks/useAlertsSync.ts`,
  dedup-checked against `by_userId_entityId_kind` before insert), `markRead`,
  `markAllRead`, `remove`/`removeAll`. Named `remove`/`removeAll`, not `delete`/
  `deleteAll` — `delete` is a reserved word, not a valid binding name, same reason
  `personalReminders.ts`/`courseActivities.ts` use `remove` too. `entityType` on the
  `alerts` table reuses the exact same union `reminders.ts`'s own `entityType` field
  uses (`courseActivities`/`semesterActivities`/`personalReminders`, matching real
  table names) — one entity-kind vocabulary in this schema, not a second, differently-
  cased one invented for this table specifically. See AGENTS.md's Alerts feed section
  for the three alert kinds and the `title`/`subtitle`/`priority`-frozen-at-creation
  schema note.
- `seed.ts` — dev-only seed data: institution, KTU faculty/department/program/class
  hierarchy, one AcademicYear spanning two Semesters, courses with per-division
  `courseSections`, course/semester activities, and a ready-to-log-in demo student
  (`demo@example.com` / `demo1234` — see README). Source of demo data for this
  project; no manual data entry via the UI during dev. Run via
  `npx convex run seed:seedAll '{"iAmSure": true}'` — the confirmation arg is
  required since Convex has no reliable built-in dev-vs-prod flag for backend code to
  check. Every function is idempotent (natural-key lookup — name/code/combined — before
  insert, never delete-then-recreate); this is the standing pattern for any future
  addition to this file, not just its current contents. Dates are always computed
  relative to `Date.now()` via the file's `atOffset` helper, never hardcoded — a
  hardcoded date drifts stale the moment "today" moves past it. The demo student's auth
  account is created via `createAccount` (`@convex-dev/auth/server`) inside an
  `internalAction` (not a mutation — password hashing needs action context, the same
  code path `signIn(..., { flow: "signUp" })` uses), pre-verified via
  `emailVerificationTime` so no OTP step is needed. Not real KTU data — see the
  fact-check comment block at the top of the file for exactly which hierarchy facts
  were verified against ktu.edu.gh directly vs. best-guessed (the index-number format
  is explicitly flagged as unconfirmed); the admin app owns this data for real once it
  exists.
  `seedAcademicYear` upserts the `academicYears` row and both semesters —
  the active semester slot is matched by the `isActive` flag, NOT by title, since this
  project's semester title string has changed at least once across earlier passes (a
  real already-running dev deployment had a semester titled differently than the
  current `SEMESTER_2_TITLE` constant) — title is not a reliable natural key for "the"
  active semester, only for the brand-new past one. `seedPastSemesterActivities` then
  backfills the past semester with its own courses and a mostly-completed activity
  history (one course activity and one personal reminder deliberately left incomplete
  even though the semester is over — a realistic "never checked it off" case, so the
  Academic Year Progress screen's completion ring reads as high but not a suspicious,
  unrealistic 100%) via `upsertPastSemesterActivity`, a push-free sibling of
  `upsertSemesterActivity` — scheduling a real push for an institutional event that
  "happened" months ago would be a confusing, misleading notification, not a demo
  feature.

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
- `validation.ts` — `isValidEmail`, `isValidPhoneNumber` (Ghanaian mobile format), both
  UI-only format checks (button-enable gating, not a substitute for server-side
  validation).
- `initials.ts` — `getInitials`, the one avatar-initials algorithm (first name's first
  letter + last name's first letter, uppercase, max 2 characters) — every avatar in the
  app calls this rather than inlining its own `.charAt(0)`. See AGENTS.md.
- `activityMapping.ts` — `UnifiedActivity` (the shared shape both Home and the Academic
  Year Progress screen map their three source queries into) plus its three mapper
  functions (`mapCourseActivity`/`mapPersonalReminder`/`mapSemesterActivity`) —
  extracted from Home's own original inline mapping once the Academic Year Progress
  screen needed the exact same thing, per AGENTS.md's "never copy component code
  between two screens" rule (applies to mapping logic, not just components).
- `semesterProgress.ts` — `computeSemesterProgress(startDate, endDate, now)`, the
  time-elapsed percent + weeks-remaining calculation both Home's `ProgressCard` and the
  Academic Year Progress screen's per-semester sub-cards use — same extraction
  reasoning as `activityMapping.ts` above.
- `reminderIntervals.ts` — `INTERVAL_OPTIONS` (now includes a `0`-minute "At deadline"
  entry) plus `INTERVAL_GROUPS`, which buckets them into the reminder-timing screen's
  three sections (Days before / Hours before / At deadline).
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
  (`secureTextEntry` prop), multiline mode (`multiline` prop, swaps in heroui's
  `TextArea` — icon/password-toggle slots don't apply in that mode).
- `Button.tsx` — the one submit/action button, wrapping heroui-native's `Button`. Full
  width by default (`fullWidth={false}` for compact inline use, e.g. ConfirmDialog's
  paired actions or ModalHeader's Save), `isLoading` + `loadingLabel` swap content in
  place without resizing, optional leading `icon` (SF-Symbol-style name, hidden while
  loading — the spinner takes its place), `size` passthrough to heroui's Button.
  **Don't use heroui's `isIconOnly` for a loading state** — that collapses the button to
  a square and was the actual cause of the old "buttons jump when loading" bug; swap the
  label/spinner inside the normal-shaped button instead.
- `DateTimeField.tsx` — TextField-styled wrapper around
  `@react-native-community/datetimepicker` (`mode: 'date' | 'time'`). Android's picker
  is natively modal (render it conditionally); iOS has no equivalent tap-to-popup for a
  spinner, so it's presented inside the app's own `Dialog` with a Done button instead —
  see the file for why the two platforms branch.
- `KeyboardAwareScreen.tsx` — wraps `Screen` with `react-native-keyboard-controller`'s
  `KeyboardAwareScrollView` (current Expo-recommended replacement for bare
  `KeyboardAvoidingView`, which is inconsistent on Android) plus a tap-to-dismiss
  `Pressable`. Needs `KeyboardProvider` at the root (already wrapped in
  `app/_layout.tsx`) and `android.softwareKeyboardLayoutMode: "resize"` in `app.json`.
  Use this instead of `Screen` for any screen with text inputs.
- `icon-symbol.tsx` / `icon-symbol.ios.tsx` — map SF-Symbol-style names to Material
  Icons on Android/web; add new names to the `MAPPING` object in the `.tsx` fallback
  when you introduce one.

`hooks/use-app-toast.tsx` — `useAppToast()`, a thin wrapper over heroui-native's own
`useToast()` (its `ToastProvider` already comes from `HeroUINativeProvider`, no separate
setup). `showSuccess`/`showError`/`showWarning` map onto heroui's `success`/`danger`/
`warning` variants, rendered via the "custom component" `toast.show({ component })`
form rather than the plain config-object form — heroui's default Toast keeps the same
neutral `bg-surface` background for every variant (only the label text tints), which
read as barely distinguishable at a glance; the custom-component version adds a real
`bg-{variant}/15` tint plus a variant icon (checkmark/exclamation-circle/exclamation-
triangle) so each state is visually distinct, same bg/icon pairing convention as
`PriorityBadge`/`ActivityCard`'s icon well. `.tsx`, not `.ts`, since it now renders JSX.
Toast is for action-level outcomes (login/signup/verification failures, rate limits,
"code sent" confirmations); per-field validation (wrong format, passwords don't match)
stays inline on the `TextField` itself — don't mix the two up.

`components/shared/` is the reuse-first inventory — see "Library-first, reuse-first" in
AGENTS.md's Design posture for the rule that populates it. Current pieces:

- `AppTopBar.tsx`, `AppTabBar.tsx` — the standard in-tab screen header and the bottom
  tab bar. `AppTabBar`'s `centerAction` prop defaults (when omitted) to the student
  side's "Add reminder" FAB; pass `centerAction={null}` for a tab bar with no center
  action at all (the admin tab bar's case — see the Admin route group section above),
  or a different `TabBarCenterAction` object to use a different one. The splice index
  and slot styling are otherwise identical either way.
- `PlaceholderScreen.tsx` — `Screen` + `AppTopBar` + centered muted "___ coming soon"
  text, for a tab whose real content isn't built yet. First used by all four
  `(admin)/(tabs)` screens (see the Admin route group section above) — reach for this
  anywhere else a "not built yet" screen is needed rather than a one-off.
- `SplashReveal.tsx` — the root layout's post-splash mark animation.
- `ConfirmDialog.tsx` — see "Confirmation & loading patterns" below.
- `ModalHeader.tsx` — the X-left / bold-centered-title / Save-right header every modal
  uses. `onSave` is optional — omit it for a display-only modal (About) and the right
  slot stays an empty equal-width column so the title still centers correctly; when
  present, `saveLabel` picks a labeled button (Edit Reminder, EditFieldModal,
  edit-academic-details) vs. an icon-only circular one (New Reminder's plus). Left/right
  slots are always equal-width flex columns so the title is genuinely centered
  regardless of how wide the Save content is, not just centered in the leftover space.
  Owns the top safe-area inset itself, like `AppTopBar`.
- `EditFieldModal.tsx` — the one single-field profile edit surface (name, phone,
  institutional email, division), reused via props rather than one modal per field:
  label, current value, an optional `validate` function, an optional `options` list
  (renders a `Select` instead of a `TextField` — Division's case, a fixed set, not free
  text), and an `onSave`. Presented via React Native's own `Modal`, not a route — see
  the `edit-academic-details.tsx` bullet above for why that's fine here specifically
  (no nested `Dialog`) but wouldn't be for the cascading edit.
- `PrioritySelector.tsx` — the three-pill Critical/Important/Flexible selector, built on
  heroui-native's `RadioGroup` (styled as filled pills, no separate radio-dot). Used by
  both Add and Edit reminder forms; anywhere else a priority gets set reaches for this,
  not a new one.
- `CourseSelect.tsx` — the course dropdown, populated from `api.courses.listMyCourses`.
  "None" is a real selectable item (not just the placeholder) so an already-picked
  course can be cleared back to standalone.
- `ReminderForm.tsx` — the shared Add/Edit reminder form body (title, description,
  `CourseSelect`, date, time, "Add end time" toggle, `PrioritySelector`). Also exports
  `isReminderFormValid`, so Add and Edit gate their `ModalHeader` Save button from the
  identical rule instead of two copies of it.
- `ActivityCard.tsx` — one row in the unified activity list, used by Home's dashboard
  sections and Calendar's day agenda (Alerts once it exists). Rebuilt for Wireframe_02
  during the Home pass — this superseded the earlier course-colour-dot-plus-`ListGroup`
  treatment entirely, not just on Home: each card is now its own bordered `rounded-md`
  surface (callers stack them with a plain gap, not a shared `ListGroup`+`Separator`
  container), three regions — a 34px `rounded-md` (not circular) icon well tinted
  `bg-{priority}/15` with an icon in `{priority}-foreground` (varies by kind/
  `activityType`: exam → triangle, quiz → book, assignment/project → doc, personal →
  checklist, semester → graduation cap, overdue → exclamation-circle, which wins over
  the type-based icon when it applies), a title + subtitle middle column, and a small
  `{priority}/15` bg + `{priority}` text pill badge on the right. `priority` is always
  the activity's real stored/domain value (CRITICAL by rule for semesterActivity, never
  stored) — same "never Calendar's dot-legend Personal bucket" rule as `PriorityBadge`
  below. The subtitle is computed internally from `dueDate`/`displayTime`/`endTime`, not
  passed in as a raw string: "Due today, 4:00 PM" for today, a plain weekday+date for
  other days, "Overdue by N days" in `text-critical` for anything overdue (never for
  semesterActivity — institutional events can't be "overdue"), with course
  title/"Personal task"/"Institutional event" only shown when `hideDate` is true
  (Calendar's agenda, where the day is already shown once in its own header line —
  Home's list spans multiple days and shows the date per-row instead, the default).
- `PriorityBadge.tsx` — the one priority pill (filled `bg-{priority}` +
  `text-{priority}-foreground`, uppercase label), first built for the reminder-timing
  screen and now reused on Activity Details' hero row rather than a second copy of the
  same three-line style map — the reminder-timing screen was refactored to use it too
  when it was extracted. Always the activity's real stored/domain priority, never
  Calendar's dot-legend "Personal" bucket (a UI-only grouping specific to that one
  screen's simplified marking system, see AGENTS.md) — don't feed it a fourth value.
- `CoursePill.tsx` — a course-context chip (code + title on a neutral pill, with a small
  dot in the course's own `colourTag`, not a colour-tinted background — `colourTag` is
  an arbitrary CSS colour string per schema, safe to use as an opaque dot/text colour,
  not safe to alpha-blend into a background without assuming a hex format the schema
  never promised). Used on Activity Details' hero row when the resolved activity has a
  course.
- `Avatar.tsx` — the one avatar: initials (via `lib/initials.ts#getInitials`) on a
  circle whose colour is derived deterministically from the `name` prop (djb2-style
  hash mod a 6-colour palette drawn entirely from existing tokens — `personal`,
  `important`, `flexible`, `critical`, `accent`, and `link` as a second, darker navy at
  the same hue as `accent` — see the component for the exact pairing), not random —
  same input always produces the same colour, so a student's avatar never flickers
  between renders/screens/sessions. Sizes `sm`/`md`/`lg` (40/44/96px) — `md` replaced
  two previously-different ad hoc sizes (Home's plain 44px circle, Settings' heroui
  `size="lg"` 64px preset) with one shared size for both "compact identity" contexts;
  `lg` is the profile detail screen's hero size. Used on Home's header, Settings'
  profile card, and the profile detail screen — reach for this anywhere else an avatar
  is needed, not heroui's own `Avatar` (still fine elsewhere it's already used, just not
  for anything representing the student themselves).
- `ActionSheet.tsx` — the three-dot "..." context menu, wrapping heroui-native's own
  `Menu` (a positioned floating popover, not a hand-rolled sheet) rather than building
  one from `Dialog` — library-first, reuse-first. Takes a `trigger` (typically a
  `Pressable` wrapping an ellipsis `IconSymbol`, the same shape as `AppTopBar`'s own
  back/close pressables) and a flat `actions` list (label, optional icon, optional
  `variant: 'danger'`). First used on Activity Details' header menu (Edit/Delete for a
  personal reminder, hidden entirely for admin-owned course/semester activities); the
  same shape is expected on activity list rows and personal reminder cards later.
- `CircularProgress.tsx` — the one completion ring (Academic Year Progress's overall
  percent), built directly on `react-native-svg` (already a project dependency) rather
  than a third-party progress library — every ready-made one takes raw colour props,
  not this app's semantic CSS-variable tokens, so there'd be no less code either way
  (see AGENTS.md's Library-first rule for when this reasoning does vs. doesn't apply).
  Fully round — exempt from the `rounded-md` card convention, same as an avatar/pill/FAB.

`components/features/auth/` (`AuthHeader` — full lockup, icon + wordmark + tagline,
sized generously as the app's identity mark) and `components/features/onboarding/` are
built: `HierarchyPicker.tsx` is the single-step Select wrapper (label, resolved
checkmark, disabled-until-populated), and `AcademicHierarchyForm.tsx` is the
orchestrator built on top of it — the whole Faculty→Division cascade, `startingFrom`-
aware (fields before it render locked/disabled and fixed to their initial value,
`startingFrom` and everything below are live). Shared by Profile Setup
(`startingFrom` omitted — everything editable) and `app/edit-academic-details.tsx`
(`startingFrom` = whichever field's pencil was tapped on the profile detail screen) —
see AGENTS.md's Profile editing section. `alerts/` now holds `AlertCard.tsx` (see the
Alerts section above). `activity-details/`, `activity-form/`, `calendar/`,
`reminders/`, `settings/` are still empty — Settings' and the reminder forms' own
screen-specific pieces so far live inline in their route files rather than under a
matching `components/features/*/` dir, since none of it is reused *within a single
screen's variants* (as opposed to across screens, which is what routes things to
`components/shared/` instead). Create the remaining empty feature dirs as each feature
is actually built, not preemptively.

### Confirmation & loading patterns

Established on the Settings pass — every protected screen inherits both, not just
Settings.

- **Destructive confirmations** always go through `components/shared/ConfirmDialog.tsx`
  (wraps heroui-native's `Dialog`) — never `Alert.alert`, whose OS-default look breaks
  the app's designed feel. Confirm is always styled danger; backdrop tap or Cancel
  dismisses; the confirm button shows its own loading state while its action's promise
  is in flight and the dialog only closes on success. First used for Settings' Log out;
  Delete activity and any future destructive action reuse this same component rather
  than a new one-off dialog.
- **Loading states** are exactly two kinds, never a third:
  - *Initial fetch* (screen just opened, a query hasn't resolved yet): skeleton
    placeholders matching the real content's shape (heroui-native's `Skeleton`), never a
    blank screen or a centered spinner. Pattern: a same-named local `<ScreenName>Skeleton`
    function returning shape-matched `Skeleton` blocks — see `SettingsSkeleton` in
    `settings/index.tsx` or `HomeSkeleton` in the Home tab.
  - *User-triggered mutation* (switch toggle, Save button): inline loading scoped to
    the control that triggered it — the shared `Button`'s `isLoading`, or a small
    `Spinner` swapped in for a header action (see `reminder-timing/[priority]`'s Save).
    Never a full-screen overlay for one control's mutation. Prefer an optimistic update
    over a loading spinner when the mutation is cheap to predict — Convex's
    `useMutation(...).withOptimisticUpdate(...)` (see Settings' notification toggles):
    flip the UI instantly, let a failed mutation revert automatically, surface a toast.

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
- **`courseActivities.ts`'s `create`/`update`/`remove` are still unauthenticated** (no
  ownership check, no auth check at all) and predate the domain clarification that
  admin — not students — owns course activities (see AGENTS.md). Nothing in this app
  calls them anymore. Fixing them isn't just "add `requireAdmin`" — the table has a
  required `studentId` field and `seed.ts` inserts one row *per student* for the same
  assignment (confirmed by reading `seed.ts`'s `ctx.db.insert('courseActivities',
  { studentId: demoUser._id, ...activity })` call), which contradicts this file's own
  domain model ("one entity, admin-owned, shared across all divisions of a class") —
  admin-owned-and-shared isn't actually how the data is shaped today. A real fix means
  choosing between (a) keep the per-student-row shape and fan out one insert per
  enrolled student per activity on create, or (b) split into a shared admin-owned
  activity-definition row plus a separate per-student completion-tracking row — which
  ripples into `activities.ts`'s resolver, `overdueSweep.ts`, `alerts.ts`, and the
  client's activity mapping. Not decided in this pass — whoever builds the Courses tab
  (`app/(admin)/(tabs)/courses/index.tsx`, currently a placeholder) makes this call.
