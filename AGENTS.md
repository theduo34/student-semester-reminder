# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Student Semester Reminder — student-facing mobile app

Final-year BTech CS project (Koforidua Technical University). Android-first Expo app
that helps students manage course assignments, quizzes, exams, institutional deadlines,
and personal tasks within a semester structure, with local push reminders and a live
dashboard.

## Scope boundary — read before building anything

This repo is the STUDENT-FACING MOBILE APP ONLY. A separate Academic Admin web app
(Next.js, different repo) publishes semesters and manages the course catalogue. Both
apps share ONE Convex backend; `convex/` in THIS repo is the source of truth for schema
and functions — the admin repo consumes a copied version for type generation.

Do NOT build semester-publishing or course-catalogue-management UI here. This app only
READS semesters/courses/institutional events that the admin app has already published
(`convex/semesters.ts`, `convex/courses.ts`, `convex/alerts.ts` are read-only queries).
Whether the admin app also needs write mutations on those three tables from this shared
backend is an open question — not built here yet, see CLAUDE.md.

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
- `@react-native-async-storage/async-storage` for offline cache, a mutation outbox, and
  the client-derived alerts read-state (see "Alerts feed" below) — not yet implemented,
  see `lib/offlineStore.ts`

## Domain model

- **Semester** — the anchor for everything, only one active at a time. Admin-published,
  read-only here.
- **Course** — Admin-published catalogue entry (courseCode, courseTitle, colourTag,
  schedule). Read-only here.
- **CourseActivity** — assignments, quizzes, projects, AND exams all live in one entity
  (`activityType`: `ASSIGNMENT | QUIZ | PROJECT | EXAM`). Owned by this app.
- **SemesterActivity** — Admin-published institutional events (registration, exam
  periods, campus events). Always CRITICAL priority, non-dismissible. Read-only here.
- **PersonalTask** — the student's own tasks, scoped per-student. Owned by this app.
- **Reminder** — a scheduled local-notification job, tied to any of the above via
  entityId/entityType. Scheduling happens on-device via expo-notifications; the Convex
  row just records what was scheduled so it can be looked up/cancelled.

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
