# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Student Semester Reminder — student-facing mobile app

Final-year BTech CS project (Koforidua Technical University). Android + iOS Expo app —
a REMINDER PLATFORM, not a task manager. Admin publishes the semester structure and
course catalogue, including every course activity (assignments, quizzes, exams) and
institutional deadline; students never create those. A student's own creative surface
is the **personal reminder** — study blocks, prep sessions, life admin, anything they
want to nudge themselves about, optionally tied to a course for context. Local push
notifications plus a live dashboard tie it together.

## Security

Every mutation touching a student's own data (personalReminders, reminderPreferences,
notificationPreferences, studentProfiles) derives the owner from the server-verified
auth identity (`getAuthUserId(ctx)`), never from a client-supplied id — see
`convex/personalReminders.ts` for the pattern. A client only ever sees "its own" data
because the query/mutation refuses to touch anyone else's; that's the actual
enforcement, not the client only ever asking for its own. Non-negotiable for anything
new: if a mutation writes to a per-student row, it checks ownership server-side first,
every time. See CLAUDE.md for the full write-up.

## Demo / seed data

`convex/seed.ts` is the source of demo data for this project — institution, KTU
hierarchy, courses, activities, and a ready-to-log-in demo student
(`demo@example.com` / `demo1234`). Run via
`npx convex run seed:seedAll '{"iAmSure": true}'`; see CLAUDE.md's Backend section for
the full breakdown and README for the quick-start version. No manual data entry via the
UI during dev — add to the seed instead. Every seed function is idempotent
(check-by-natural-key before insert, never delete-then-recreate) — that's the standing
rule for anything added to this file going forward, not just what's there today. Dates
in seed data are always relative to `Date.now()`, never hardcoded. Hierarchy facts
(faculty/department/program names, email domain) are verified against ktu.edu.gh where
the file's fact-check comment says so; anything not marked verified (the index-number
format, specifically) is a best guess, flagged rather than presented as fact — course
codes/titles/activity content are invented example data by design, nothing to verify.

## Scope boundary — read before building anything

This repo is the STUDENT-FACING MOBILE APP ONLY. A separate Academic Admin web app
(Next.js, different repo) publishes semesters and manages the course catalogue. Both
apps share ONE Convex backend; `convex/` in THIS repo is the source of truth for schema
and functions — the admin repo consumes a copied version for type generation.

Do NOT build semester-publishing, course-catalogue-management, or institutional-
hierarchy-management (Faculty/Department/Program/academicClass/Division CRUD) UI here.
This app only READS that data once the admin app has published it
(`convex/semesters.ts`, `convex/courses.ts`, `convex/alerts.ts`, `convex/
academicStructure.ts` are all read-only queries). Whether the admin app also needs write
mutations on those tables from this shared backend is an open question — not built here
yet, see CLAUDE.md.

## Tech stack

- Expo + Expo Router (file-based routing) — not React Navigation directly
- TypeScript strict; Convex (real-time backend, no separate REST layer)
- Convex Auth (`@convex-dev/auth`, Password provider) for email/password auth — check
  current docs before changing anything here, the API has moved across versions
- HeroUI Native (`heroui-native`) for UI components, styled via Tailwind v4 through
  Uniwind — `className` with semantic tokens (`bg-background`, `text-foreground`,
  `bg-danger`, `text-muted`, `border-border`, ...) defined in `global.css`. No
  `StyleSheet.create` objects.
- `expo-notifications` for locally-scheduled reminders (channels: critical / important /
  flexible, see priority model below)
- `expo-calendar` for device-calendar sync; `react-native-calendars` (Wix) is the one
  calendar UI library for the project — the Calendar tab's month/week grids are a
  theming/composition job on top of its `Calendar`/`WeekCalendar`/`CalendarProvider`,
  never a hand-rolled month grid or week strip, and never a second calendar library
  introduced for a variant look
- `react-native-keyboard-controller` for keyboard-aware scrolling/dismissal — current
  Expo-recommended replacement for bare `KeyboardAvoidingView`. Use
  `components/ui/KeyboardAwareScreen.tsx`, don't wire it up per screen.
- `@react-native-async-storage/async-storage` for offline cache, a mutation outbox, and
  the client-derived alerts read-state (see "Alerts feed" below) — not yet implemented,
  see `lib/offlineStore.ts`

## Domain model

### Institutional hierarchy

Institution → Faculty → Department → Program → **academicClass** (Level + Session) →
Division (optional). A student belongs to exactly one Faculty/Department/Program/Level/
Session combination, and optionally one Division within it. Entirely Admin-published,
read-only here (`convex/academicStructure.ts`).

- **Institution** — single row for now (Koforidua Technical University,
  `emailDomain: "ktu.edu.gh"`). Name and email domain are always read from this row, not
  hardcoded — `studentProfiles.createProfile` validates the student's institutional
  email against it, so a wrong/changed domain is a one-row edit, not a code change.
- **Faculty → Department → Program** — a straight one-parent-each tree.
- **academicClass** — a resolved Program + Level + Session triple (e.g. "HND Computer
  Science, Level 200, Regular"). Called `academicClass` everywhere — schema, types,
  variables, filenames — never the bare word `class`, a reserved identifier in JS/TS.
  Levels and sessions are derived from real `academicClasses` rows, never hardcoded —
  not every program has 4 levels or offers both Regular and Weekend.
- **Division** — optional subdivision (A–E). A class with none simply has zero
  `divisions` rows — treat "undivided" as a real, common state, not an edge case.

### Academic entities

- **Semester** — the anchor for everything, only one active at a time. Admin-published,
  read-only here.
- **Course** — Admin-published catalogue entry (courseCode, courseTitle, colourTag,
  academicClassId). Read-only here. Admin picks the academicClass directly when
  creating a course — Faculty/Department are implied, never entered separately.
- **CourseSection** — one course's schedule (days/time/venue) for one Division, or for
  the whole class if undivided (`divisionId` absent). Lives on its own table rather than
  on `courses` or `courseActivities` because schedule varies by Division but activities
  don't — every student in a class sees the same assignments/exams regardless of which
  section's schedule they follow. Resolve a student's section by preferring their
  `divisionId`, falling back to the undivided section.
- **CourseActivity** — assignments, quizzes, projects, AND exams all live in one entity
  (`activityType`: `ASSIGNMENT | QUIZ | PROJECT | EXAM`). Admin-published and
  admin-owned, exactly like Course/CourseSection above — students never create or edit
  these from this app, only read and display them, shared across all divisions of a
  class (see CourseSection above). `convex/courseActivities.ts`'s `create`/`update`/
  `remove` mutations predate this clarification and are unauthenticated leftovers from
  before student-vs-admin ownership was settled — no screen calls them anymore; not
  removed in this pass, flagged as a cleanup item in CLAUDE.md's open questions.
- **SemesterActivity** — Admin-published institutional events (registration, exam
  periods, campus events). Always CRITICAL priority, non-dismissible, and
  institution-wide — confirmed NOT scoped to an academicClass, unlike Course. Read-only
  here.
- **PersonalReminder** — the student's own reminders and the one thing they actually
  create in this app: study blocks, prep sessions, life admin, anything they want to
  nudge themselves about. Optionally tied to a Course for context/colour-coding
  (validated server-side against the student's own academicClass on every write, never
  trusted from the client — see Security above). `startTime` is what a notification
  actually fires against; the optional `endTime` only marks a time-range reminder for
  display purposes — the range's end is never a second trigger. No sharing/visibility
  field in this MVP — class-rep sharing between students is a real future want,
  deliberately not built now, and kept off the schema entirely rather than stubbed, so
  adding it later is a plain additive migration, not a rename or backfill.
- **Reminder** — a scheduled local-notification job, tied to any of the above via
  entityId/entityType. Scheduling happens on-device via expo-notifications; the Convex
  row just records what was scheduled so it can be looked up/cancelled. Distinct from
  **reminderPreferences** (per-priority, per-student arrays of minutes-before-due — what
  Settings' reminder-timing rows edit) and **notificationPreferences** (per-student
  push/sound/calendar-sync toggles) — those two tables hold the settings that
  *determine* what gets scheduled, not the scheduled jobs themselves.
- **StudentProfile** — one row per student (Faculty/Department/Program/academicClass/
  Division + institutional email, index number, phone number), created during
  onboarding. Its *absence* for the signed-in user is the "needs onboarding" gate state
  — no separate synced boolean. See CLAUDE.md's Routing section for the full gate
  sequence. No profile photo field — confirmed scope decision, initials-in-circle avatar
  stays as the UI, no file storage needed. Faculty/Department/Program are denormalized
  onto this row even though derivable by walking up from academicClassId — avoids a
  3-hop join on every dashboard/list query; don't "clean up" that redundancy. Every
  field is student-editable after onboarding *except* indexNumber (identity, routes
  through admin — see "Profile editing" below) — name lives on the auth `users` table,
  not here, and email there is the separate auth account address, not editable from
  this app (would need re-verification, out of scope).

## Profile editing — WhatsApp-style, pencil-per-field

`app/(protected)/settings/profile/index.tsx`: large avatar, name, "Joined [date]" up
top; grouped rows below (ACCOUNT, ACADEMIC) where a row either shows just its value
(read-only) or its value plus a pencil icon (editable) — never both a value and a
*disabled* pencil. No global "Edit" button, no edit-mode toggle; the pencil (or its
absence) is the only signal, so a glance at the screen tells you what's editable
without tapping anything first. Applies to any future user-editable detail screen, not
just this one.

- **Single-field edits** (name, phone, institutional email, division) open
  `components/shared/EditFieldModal.tsx` — one TextField (or a Select when the field is
  a fixed set, e.g. Division), pre-filled, Save disabled until changed and valid.
- **Academic hierarchy edits** (Faculty/Department/Program/Level/Session) are
  cascading, not single-field — see below.
- **Avatar**: `components/shared/Avatar.tsx` is the one avatar — initials (first name's
  first letter + last name's first letter, uppercase, always exactly 1 or 2 characters
  via `lib/initials.ts#getInitials`, e.g. `"Kwame Nkrumah Ofori-Atta"` → `"KO"`, not
  `"KNO"`; a single-word name → its one letter) on a circle whose colour is derived
  deterministically from the student's name (a stable hash into a small palette drawn
  from existing tokens) rather than a flat neutral background — same student, same
  colour, every render. Every avatar in the app (Settings, profile detail, Home) uses
  this component; never inline `.charAt(0)` or a plain muted circle for a new one.

### Cascading academic hierarchy edits

Faculty through Session are editable but cascading — correcting one can invalidate
everything below it (a different Program can have different Levels, different
Sessions, different Divisions). Tapping the pencil on any of these five fields opens
`app/edit-academic-details.tsx` with `startingFrom` set to whichever field was tapped,
reusing `components/features/onboarding/AcademicHierarchyForm.tsx` — the exact same
cascade Profile Setup uses (`startingFrom` omitted there, since everything is editable
on first setup). Fields above `startingFrom` render locked (shown, disabled, fixed to
their current value); `startingFrom` and everything below are live and "sticky" —
pre-filled from the current value, only clearing downstream once the student actually
changes something upstream, exactly like Profile Setup's own cascade already did.

Saving a cascading change is consequential — it can move the student to a different
academicClass, which can orphan personal reminders linked to a course from the old
one — so Save always goes through a `ConfirmDialog` first
(`"Confirm academic details change"`), not a direct save. On confirm,
`studentProfiles.updateAcademicHierarchy` re-validates the whole chain server-side (it
doesn't trust the client sent a self-consistent set of ids, unlike `createProfile`,
since this mutation is more consequential) and nulls out — never deletes —
`personalReminders.courseId` for any reminder whose course no longer belongs to the
new academicClass. The reminder survives as a standalone one; the student can
re-attach it or delete it themselves.

Index number stays admin-managed on purpose: self-service edits here are for
correcting an academic-hierarchy selection mistake, not for identity fields.

Priority model, three tiers (supersedes any earlier HIGH/MEDIUM/LOW naming — use these
going forward):
- **Critical** — institutional deadlines, exams. Non-dismissible.
- **Important** — assignments, quizzes, projects.
- **Flexible** — personal reminders, lower-stakes course items.

## Alerts feed

The Alerts tab is a client-derived log, Convex-backed (the `alerts` table), not real OS
push notifications — real server push (Expo push tokens + a Convex push action) stays a
deliberate scope boundary, out for the MVP. Three kinds, one central write path:

- **`REMINDER_FIRED`** — a courseActivity/personalReminder's configured
  reminderPreferences interval has passed relative to its due time (courseActivity:
  `dueDate`; personalReminder: `startTime`, matching what an actual notification would
  fire against). **Flagged gap**: no real on-device notification scheduling exists in
  this app yet (`expo-notifications` isn't actually called anywhere to schedule
  anything — see CLAUDE.md's `hooks/` section) — this kind is derived from data
  (has the trigger time implied by the configured interval passed?) rather than
  observing a real fired notification, the closest available approximation until local
  scheduling is built as its own pass.
- **`NEW_EVENT`** — a semesterActivities row created after the student's
  `studentProfiles.lastSeenAlertsAt`. A student's first-ever sync baselines this
  timestamp without alerting on the pre-existing catalogue, rather than dumping every
  institutional event that existed before they signed up into their feed.
- **`OVERDUE`** — a courseActivity/personalReminder's `dueDate` has passed while not
  completed. Institutional events (semesterActivities) never generate this kind — they
  have no completion concept to be "overdue" against.

All three are written by **`hooks/useAlertsSync.ts`**, the one place this logic lives —
called once from the root layout, on mount/foreground/a 5-minute interval, not scattered
per-screen. Any future alert source hooks in there too. Deduped server-side by
`(userId, entityId, kind)` before insert (`convex/alerts.ts#create`), so a redundant
sync pass (clock drift, a second foreground within the same interval) never produces a
duplicate.

**Schema note**: the alerts table also stores `title`/`subtitle`/`priority`, frozen at
creation time — not re-derived from `entityId` on every read. A live join across three
different tables would go stale the instant a relative-time message ("due in 3 hours")
was written, and would break outright if the referenced entity is later edited or
deleted. This is the same behavior any real push notification already has: what you
received is what it said at send time, not a live view of current state.

Alert cards group into four time buckets — Today / Yesterday / This week / Earlier — by
`createdAt`; an empty bucket is omitted entirely (see CLAUDE.md's Alerts section for the
exact boundaries). Tapping a card marks it read optimistically (flip `isRead`
immediately, mutation in the background, no visual delay) and navigates to Activity
Details via the same polymorphic route every other activity tap uses. Single-item
delete is swipe-to-reveal (`react-native-gesture-handler`'s `Swipeable`, already a
project dependency) with no confirmation — the standing rule for low-stakes list-item
dismissal in this app going forward; `ConfirmDialog` stays reserved for bulk/high-stakes
actions (Clear all alerts, Log out, Delete a reminder from Activity Details).

## First-run landing carousel

`app/(landing)/` is a 3-slide "welcome to Termio" carousel shown once, ever, per
device install, before `(auth)` — see CLAUDE.md's Routing and Onboarding gate sections
for exactly how the gate decides this and why it's a device-local flag, not a per-
account one. Copy tone: grounded and specific about what the app actually does, not a
marketing pitch — students skim these once and never see them again, so each slide
states one real capability (unified schedule view, personal reminders, institution-
aware filtering) in plain language rather than building toward a pitch across all
three. No slide references a feature that isn't built, and none tries to sell the app —
it's orienting a student who's about to sign up, not persuading a stranger.

## Activity details routing

`app/(protected)/activity/[entityId]/index.tsx` is one route with branching render, not
three separate screens to keep in sync — the template for any future "detail screen
that could show N different entity kinds," not a one-off. It accepts an optional `type`
query param (course | semester | personal) carried from notification payloads or
list-item taps, but never trusts it blindly: `convex/activities.ts#resolveById` is a
single Convex resolver query that checks courseActivities, semesterActivities, and
personalReminders in sequence via `ctx.db.normalizeId` (the documented Convex mechanism
for "this id string might belong to one of several tables" — returns null instead of
throwing when it doesn't decode to that table, which is what makes probing three tables
safely possible), ownership-checked per kind exactly like every other per-student query
(see Security above). The client always calls this resolver regardless of what `type`
says; the param is a hint for notification routing, never the source of truth.

The screen renders one hero section (priority badge + optional course pill + title +
type sub-line), one countdown card (adapted per kind: hour/minute precision for
course activities and personal reminders, day-only "All day" framing for semester
activities, a time-range line when a personal reminder has an `endTime`), one info-row
list, an optional notes/description card, and a bottom action bar whose content and
visibility both vary by kind and completion state — not three differently-shaped
screens. A course activity's "Mark complete" goes through the new, auth-checked
`courseActivities.updateStatus` mutation (ownership derived from `ctx.auth`, same
pattern as every other per-student write in this app — the table's older `create`/
`update`/`remove` mutations predate that pattern and stay unauthenticated leftovers, see
the open questions below).

## Display integration — unified activity list

Home and Calendar (and eventually Alerts, once it exists — see CLAUDE.md) render
course activities, personal reminders, and semester activities via the one shared row,
`components/shared/ActivityCard.tsx` — never two separate sections, never a
screen-specific copy of the same row. Rebuilt for Wireframe_02 during the Home pass:
priority is the row's organizing colour now, not course `colourTag` — a left icon well
tinted to the item's real priority (CRITICAL/IMPORTANT/FLEXIBLE, CRITICAL by rule for a
semester activity, never a stored field there) with a priority-varying icon, and a
small priority-tinted badge on the right. Course `colourTag` and the old "•"
own-vs-admin indicator are gone from this row entirely — a course-linked item's course
name only surfaces via the subtitle when `hideDate` is set (Calendar's agenda; see
below), not as a persistent colour cue on every row. Time-range reminders (`endTime`
present) display as a range ("4:00 PM – 6:00 PM") in the subtitle when due today;
everything else shows a single time — don't invent a separate "range" badge/chip for
this, the times already say it.

The subtitle text itself is computed inside `ActivityCard`, not passed in as a string:
due today shows a time, other days show a plain date, anything overdue (never a
semester activity — institutional events can't be "overdue") shows "Overdue by N days"
in `--critical`. `hideDate` (Calendar's agenda, where the day is already shown once in
its own header line) swaps this for course title / "Personal task" / "Institutional
event" instead — see CLAUDE.md's Home section for the full breakdown.

Calendar's month/week grid uses a *different*, simpler colour system than
`ActivityCard`'s per-row treatment — every day gets one dot per distinct priority tier
present (deduplicated, not one dot per activity), and every personal reminder buckets
as "Personal" there regardless of its own priority field. See CLAUDE.md's Calendar
section for why the grid's bucket and a row's own priority colour aren't the same rule
and shouldn't be unified.

## UX conventions

- Mark complete: optimistic update + "Undo" snackbar, no confirmation dialog —
  reversible, low-stakes.
- Delete (and every other destructive, irreversible action — Log out included):
  `components/shared/ConfirmDialog.tsx`, never native `Alert.alert` — its OS-default
  look breaks the app's designed feel. Confirm is styled danger; see CLAUDE.md's
  "Confirmation & loading patterns" for the component's full contract.
- Toast vs. inline error: toast (`hooks/use-app-toast.ts`) for action-level outcomes —
  a submit/login/verification attempt failing or succeeding as a whole. Inline
  `TextField` errors for per-field validation the user can see and fix without leaving
  the field (wrong format, passwords don't match). Don't use one where the other
  belongs.
- Empty/loading states are real states to design, not dead ends: a screen with no data
  yet (Home with no activities, a semester still loading) always renders its real shell
  (header, any summary card) and only swaps the content area — never replaces the whole
  screen with a blocking message. That's what a dedicated gate screen
  ((onboarding)'s waiting screen for "no semester") is for; once past the gate, treat
  "empty" as a normal, common state with its own designed empty-state UI, not an error.
- Loading has two distinct treatments, not one: skeleton placeholders for a screen's
  initial data fetch, inline loading (spinner or disabled state on the specific control)
  for a user-triggered mutation. Never a centered full-screen spinner for either case.
  See CLAUDE.md's "Confirmation & loading patterns" for the component-level contract —
  this applies to every protected screen, not just Settings where it was established.
- Row helper text (a `ListGroup.ItemDescription`, a settings row's subtitle, etc.) is
  one short line, no more — if it doesn't fit cleanly on one line, cut it rather than
  wrapping to two. No trailing period unless it's a genuine multi-sentence stop. If a
  setting truly needs more explanation than that, the explanation belongs on a detail
  screen, not stretched across the row.
- No null rows, no "N/A"/"—" placeholder values: a key-value row (Activity Details'
  info rows are the current example) is rendered only when it has a real value to show.
  Missing or inapplicable data means the row is absent from the list entirely, not
  present with a dash or placeholder string — a row that exists just to say "nothing
  here" is noise the student has to read past, not information. Applies anywhere a
  screen builds a variable-length list of key-value rows, not just this one screen.

## Design posture

Wireframes are a snapshot, not a frozen spec — requirements will change. Prefer one
flexible/polymorphic component over several near-duplicates for variants of the same
concept. Build the underlying data/resolver layer to support all relevant cases even if
only one is fully styled today — don't hardcode assumptions a wireframe only happens to
show once. When a wireframe is silent on a UX decision (confirmations, error/loading/
empty states), apply the standard pattern for that action's risk level rather than
guessing silently, or ask if genuinely ambiguous. If a wireframe implies a Convex
capability that doesn't exist yet (new table, field, or function), stop and flag it
rather than quietly working around it client-side.

**Library-first, reuse-first** — the default approach for any new UI work, not a
suggestion to weigh against hand-rolling:

1. Check whether heroui-native already provides the primitive (header, sheet, select,
   date/time input, toggle, checkbox, ...). Use it directly, or wrap it with the app's
   token styling — don't rebuild what the library ships.
2. If heroui-native doesn't cover it, reach for a well-maintained React Native library
   (checked for current maintenance) before writing custom native-feeling UI from
   scratch — e.g. `@react-native-community/datetimepicker` for the reminder form's
   date/time inputs, rather than a hand-rolled picker that behaves differently per
   platform.
3. Only build from scratch if neither applies, or the library option genuinely doesn't
   fit — and say so explicitly when it happens, so the decision reads as deliberate,
   not reflexive.

**Card border-radius is a shared token, not a per-screen choice**: every card, group,
modal container, and equivalent rectangular grouped surface uses `rounded-md` (global.
css's `--radius-md`), applied via `className="rounded-md"` since heroui-native's own
`Card`/`ListGroup`/`Dialog.Content`/`Select.Content` all default to a much larger
`rounded-3xl` (they extend the same `Surface` primitive). This is applied per call
site, not a global CSS override — search for `rounded-md` in any of those components
before adding a new one to see the pattern. Fully round shapes (an avatar, a pill/badge,
a circular FAB, a carousel dot indicator — the landing carousel's is the current
example) are exempt — this rule is about rectangular surfaces only.

**Derived data fed to a third-party list/calendar prop is always memoized off its
source query data, never recomputed inline in the render body.** `react-native-
calendars`' `markedDates` is the concrete example (see CLAUDE.md) — recomputing it on
every render is a known performance sink with that library specifically, but the rule
itself is general: anything shaped once from query results for a prop like this uses
`useMemo` keyed on the underlying data, not ad hoc per-render construction.

**Screen horizontal padding is set once, globally, never per nested component.**
`Screen`'s `SCREEN_HORIZONTAL_PADDING` is the only source of horizontal inset; content
rendered inside it (including a third-party component's own default padding, e.g.
`react-native-calendars`' grid) must not add a second layer of `px-*`/margin/internal
padding on top. Surfaced twice so far — reminder-timing and the Calendar screen's
month/week grids — see CLAUDE.md's Styling section for the standing rule and the
Calendar section for the library-specific override.

**A calendar day cell has exactly two highlight states, and today always wins.**
Today gets the strong filled `--accent` box; the selected day (when not today) gets a
light `--accent` tint box; both are `--radius-md`, never circular; if a day is both,
only today's stronger style renders — there's no third "selected + today" look. See
CLAUDE.md's Calendar section for the exact mechanism.

**Any epoch-ms-to-calendar-day mapping uses the shared `lib/dateKey.ts#toDateKey`
helper, never a local reimplementation or `toISOString()`.** `toISOString()` is UTC and
can shift a late-evening local timestamp into the next day, breaking exactly this kind
of by-day bucketing — see CLAUDE.md's Styling section and the Calendar section's
bucketing note.

**Never copy component code between two screens.** The moment something is needed a
second time, it moves to `components/shared/` or `components/ui/` — not "later," not
"once it's needed a third time." If it's obvious upfront a piece will be reused (a modal
header every modal will want, a priority selector every activity form will want), it
starts in shared, first pass. This is what keeps the app from drifting back into the
per-screen visual inconsistency the auth pass had to clean up.

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
shift), update both this file and `CLAUDE.md` before declaring the pass done — not just
when explicitly asked. Update the section that's now wrong rather than appending a new
one that contradicts it.
