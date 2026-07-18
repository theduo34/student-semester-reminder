# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Student Semester Reminder — student-facing mobile app

Final-year BTech CS project (Koforidua Technical University). Android + iOS Expo app
that helps students manage course assignments, quizzes, exams, institutional deadlines,
and personal tasks within a semester structure, with local push reminders and a live
dashboard.

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
- `expo-calendar` + `react-native-calendars` for calendar view/sync
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
  (`activityType`: `ASSIGNMENT | QUIZ | PROJECT | EXAM`). Owned by this app, shared
  across all divisions of a class (see CourseSection above).
- **SemesterActivity** — Admin-published institutional events (registration, exam
  periods, campus events). Always CRITICAL priority, non-dismissible, and
  institution-wide — confirmed NOT scoped to an academicClass, unlike Course. Read-only
  here.
- **PersonalTask** — the student's own tasks, scoped per-student. Owned by this app.
- **Reminder** — a scheduled local-notification job, tied to any of the above via
  entityId/entityType. Scheduling happens on-device via expo-notifications; the Convex
  row just records what was scheduled so it can be looked up/cancelled.
- **StudentProfile** — one row per student (Faculty/Department/Program/academicClass/
  Division + institutional email, index number, phone number), created during
  onboarding. Its *absence* for the signed-in user is the "needs onboarding" gate state
  — no separate synced boolean. See CLAUDE.md's Routing section for the full gate
  sequence. No profile photo field — confirmed scope decision, initials-in-circle avatar
  stays as the UI, no file storage needed. Faculty/Department/Program are denormalized
  onto this row even though derivable by walking up from academicClassId — avoids a
  3-hop join on every dashboard/list query; don't "clean up" that redundancy.

Priority model, three tiers (supersedes any earlier HIGH/MEDIUM/LOW naming — use these
going forward):
- **Critical** — institutional deadlines, exams. Non-dismissible.
- **Important** — assignments, quizzes, projects.
- **Flexible** — personal tasks, lower-stakes course items.

## Alerts feed — two different mechanisms, do not conflate

1. Assignment/exam/personal reminders: scheduled entirely on-device via
   `expo-notifications` at creation time. No server involvement.
2. Admin-originated alerts ("new institutional event published"): these originate in the
   separate Admin app and can't be delivered via local scheduling. Real server push
   (Expo push tokens + a Convex push action) is a deliberate scope boundary, out for the
   MVP — see the comment in `convex/alerts.ts`. Instead, since Convex is already
   real-time, the client watches `alerts.listBySemester` for new semesterActivities rows
   and logs anything new into a local read/unread feed (AsyncStorage) shown in the
   Alerts tab next time the app is open.

## Activity details routing

`app/(protected)/activity/[entityId]/index.tsx` is one route with branching render, not
three separate screens to keep in sync. It accepts an optional `type` query param
(course | semester | personal) carried from notification payloads or list-item taps, but
must not trust it blindly — resolve it against a single Convex resolver query that
checks courseActivities, then semesterActivities, then personalTasks in sequence if the
param is missing or stale. Render conditionally by the resolved kind: full countdown-card
for course activities/exams, simpler read-only card for institutional events, lightweight
toggle view for personal tasks.

## UX conventions

- Mark complete: optimistic update + "Undo" snackbar, no confirmation dialog —
  reversible, low-stakes.
- Delete: native `Alert.alert` confirmation — destructive and irreversible, the one case
  that warrants a confirmation dialog by default.
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
