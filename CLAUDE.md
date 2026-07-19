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
- `app/(onboarding)/` — `profile-setup.tsx` (renders
  `components/features/onboarding/AcademicHierarchyForm.tsx` with `startingFrom`
  omitted, i.e. every field editable — see AGENTS.md's Profile editing section; the
  cascade itself is shared with the profile detail screen's academic-edit flow, not
  inline here anymore) and `index.tsx` (waiting screen, shown once a profile exists but
  no semester is active yet — "Check now" is reassurance only, the
  `semesters.getActive` subscription already navigates away the instant one goes live).
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
  below. Alerts is still the bare placeholder from the auth pass (no alerts-feed
  AsyncStorage infra yet); wiring it up is its own pass, not done here.
- `app/add-activity.tsx`, `app/edit-activity/[entityId].tsx` — root-level modals
  (`presentation: "modal"`), reachable from anywhere via the FAB or an edit action. Both
  are the New/Edit Reminder forms — students only ever create personal reminders, so
  there's no "course activity" tab here (see AGENTS.md). Both use
  `components/shared/ModalHeader.tsx` and `components/shared/ReminderForm.tsx`, not
  `AppTopBar` — see Components below.
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

### Calendar (`app/(protected)/(tabs)/calendar/index.tsx`)

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
agenda row's displayed time) — which can diverge, since `ReminderForm` edits them via
two independent, uncorrelated pickers. Bucketing by `startTime` instead of `dueDate`
was a real bug here (a personal reminder due on day N with a `startTime` that rolled
into day N+1 silently vanished from day N's agenda); the fix is the `dueDate`/
`displayTime` field split on `CalendarActivity` in the screen file — bucket by
`dueDate` always, display by `displayTime`, never conflate the two. Both the bucketed
map and the `markedDates` object derived from it are `useMemo`'d off the same query
results — recomputing `markedDates` on every render is a known performance sink
specific to this library (see AGENTS.md's general version of this rule). Selecting a
day just reads `activitiesByDay.get(selectedDate)` for the agenda list below — no
separate "scroll to this day" logic, since the agenda is a filtered view for one day,
not a running list.

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
Design posture for the full rule and the fully-round exemptions (avatars, pills, FABs).

### Backend (`convex/`)

`schema.ts` is the single source of truth (also consumed, copied, by the separate admin
repo — see `AGENTS.md`). Auth tables come from `@convex-dev/auth`'s `authTables`.

- `auth.config.ts` / `auth.ts` — Password provider with `verify: ResendOTP` (see
  `ResendOTP.ts`) and a `profile()` callback capturing `name` on signup. `reset` is
  deliberately left unconfigured — forgot-password stays interface-only.
- `users.ts` — `viewer` query (current user or null), the auth-gate's first check, plus
  `updateName` — the one field the profile detail screen edits on the auth `users`
  table rather than `studentProfiles`.
- `academicStructure.ts` — read-only institutional hierarchy queries (Faculty through
  Division), see AGENTS.md, plus `getFullHierarchy` — resolves an entire profile's
  faculty/department/academicClass/division ids to human-readable names in one call
  (profile detail screen's ACADEMIC group, the cascading edit picker's pre-fill).
- `studentProfiles.ts` — `getMyProfile` / `createProfile`, the onboarding-gate table.
  Also `updatePhoneNumber` / `updateInstitutionalEmail` / `updateDivision` (single-field
  edits, ownership-checked via a shared `requireMyProfile` helper) and
  `updateAcademicHierarchy` (the cascading edit — re-validates the whole Faculty→
  Division chain server-side rather than trusting the client sent a self-consistent set
  of ids, unlike `createProfile`, since moving a student to a different academicClass is
  more consequential; also nulls out — never deletes — any `personalReminders.courseId`
  that no longer belongs to the new academicClass. See AGENTS.md's Profile editing
  section for the full picture).
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
- `seed.ts` — dev-only seed data: institution, KTU faculty/department/program/class
  hierarchy, courses with per-division `courseSections`, course/semester activities,
  and a ready-to-log-in demo student (`demo@example.com` / `demo1234` — see README).
  Source of demo data for this project; no manual data entry via the UI during dev.
  Run via `npx convex run seed:seedAll '{"iAmSure": true}'` — the confirmation arg is
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

`hooks/use-app-toast.ts` — `useAppToast()`, a thin wrapper over heroui-native's own
`useToast()` (its `ToastProvider` already comes from `HeroUINativeProvider`, no separate
setup). `showSuccess`/`showError`/`showWarning` map onto heroui's `success`/`danger`/
`warning` variants. Toast is for action-level outcomes (login/signup/verification
failures, rate limits, "code sent" confirmations); per-field validation (wrong format,
passwords don't match) stays inline on the `TextField` itself — don't mix the two up.

`components/shared/` is the reuse-first inventory — see "Library-first, reuse-first" in
AGENTS.md's Design posture for the rule that populates it. Current pieces:

- `AppTopBar.tsx`, `AppTabBar.tsx` — the standard in-tab screen header and the bottom
  tab bar (with the FAB slot).
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
  list and Calendar's day agenda today (Alerts once it exists). Course activities,
  personal reminders, and semester activities all render through it — see AGENTS.md's
  Display integration section for the colour/indicator rules. `hideDate` drops the
  per-row date (Calendar's agenda already shows it once, in its own header line; Home's
  list spans multiple days and needs it per-row, the default).
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
  course; second usage of "course code + title as a small chip" after `ActivityCard`'s
  dot, extracted per the reuse-first rule.
- `ActionSheet.tsx` — the three-dot "..." context menu, wrapping heroui-native's own
  `Menu` (a positioned floating popover, not a hand-rolled sheet) rather than building
  one from `Dialog` — library-first, reuse-first. Takes a `trigger` (typically a
  `Pressable` wrapping an ellipsis `IconSymbol`, the same shape as `AppTopBar`'s own
  back/close pressables) and a flat `actions` list (label, optional icon, optional
  `variant: 'danger'`). First used on Activity Details' header menu (Edit/Delete for a
  personal reminder, hidden entirely for admin-owned course/semester activities); the
  same shape is expected on activity list rows and personal reminder cards later.

`components/features/auth/` (`AuthHeader` — full lockup, icon + wordmark + tagline,
sized generously as the app's identity mark) and `components/features/onboarding/` are
built: `HierarchyPicker.tsx` is the single-step Select wrapper (label, resolved
checkmark, disabled-until-populated), and `AcademicHierarchyForm.tsx` is the
orchestrator built on top of it — the whole Faculty→Division cascade, `startingFrom`-
aware (fields before it render locked/disabled and fixed to their initial value,
`startingFrom` and everything below are live). Shared by Profile Setup
(`startingFrom` omitted — everything editable) and `app/edit-academic-details.tsx`
(`startingFrom` = whichever field's pencil was tapped on the profile detail screen) —
see AGENTS.md's Profile editing section. `activity-details/`, `activity-form/`, `alerts/`,
`calendar/`, `reminders/`, `settings/` are still empty — Settings' and the reminder
forms' own screen-specific pieces so far live inline in their route files rather than
under a matching `components/features/*/` dir, since none of it is reused *within a
single screen's variants* (as opposed to across screens, which is what routes things to
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
- **Whether the admin app needs write mutations** on `semesters`/`courses`/
  `semesterActivities`/the institutional hierarchy tables from this shared Convex
  deployment (vs. writing through some other path) is unresolved — this app currently
  only exposes read queries for all of them.
- **`courseActivities.ts`'s `create`/`update`/`remove` mutations are unauthenticated**
  (no ownership check, no auth check at all) and predate the domain clarification that
  admin — not students — owns course activities (see AGENTS.md). Nothing in this app
  calls them anymore. Not removed here since the admin app may still want them (or an
  admin-gated equivalent) once it writes into this shared deployment — see the write-
  mutations question above — but leaving unauthenticated mutations sitting in a shared
  backend is a real gap, flagged rather than silently carried forward.
