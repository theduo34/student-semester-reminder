# Convex backend reference (for the separate admin web app repo)

This document describes the `convex/` backend as it exists in the **student-semester-
reminder** mobile app repo (Koforidua Technical University final-year project). The
admin dashboard is being built as a **separate web app in a separate repo**, connecting
to the same Convex project/deployments. Read this before writing any admin backend code
— it tells you what exists, what's missing, and what's unsafe to build on.

## Architectural landmine: who owns `convex/`

Convex functions are deployed from whichever `convex/` folder last runs
`npx convex deploy` against a given deployment. **Two repos cannot both own one Convex
deployment's backend code** — whichever deploys last silently overwrites the other's
schema and functions. Before writing any backend code here, confirm with the project
owner which of these is true:

- **A. This (admin) repo is client-only.** It never runs `npx convex deploy`. Every
  query/mutation it needs must be written in and deployed from the mobile repo's
  `convex/`, then consumed here via the generated client types. New admin mutations get
  added to the mobile repo, not this one.
- **B. `convex/` gets extracted into its own repo/package**, and both apps depend on it
  externally.

Do not assume either — ask before scaffolding a `convex/` directory in the admin repo.

## Deployments

Three Convex deployments exist for the mobile app project — see its `CLAUDE.md` for
exact names/URLs/provisioning history:

- **dev** — `npx convex dev`'s live-watched deployment.
- **preview** — provisioned but currently unused by any build profile.
- **production** — the deployment actually serving demo/build traffic.

JWT signing keys are per-deployment and deliberately not shared. `AUTH_RESEND_KEY` is
the one env var shared across all three (copied manually, not derived). The admin web
app must target one of these same deployments explicitly per environment (dev vs prod)
— it does not get its own fourth deployment.

## Schema (`convex/schema.ts`)

**Shared validators**:
- `priorityValidator` — `CRITICAL | IMPORTANT | FLEXIBLE`
- `activityStatusValidator` — `PENDING | COMPLETED`
- `entityType` — `courseActivities | semesterActivities | personalReminders`
- `alertKindValidator` — `REMINDER_FIRED | NEW_EVENT | OVERDUE`
- `sessionValidator` — `REGULAR | WEEKEND`
- `userRoleValidator` — `student | admin`

| Table | Fields | Indexes | Write-owner |
|---|---|---|---|
| `users` (extends `authTables.users`) | `...authTables.users.validator.fields`, `role`, `institutionId?` | `email`, `phone` | auth system + admin/student signup |
| `academicYears` | `title`, `startDate`, `endDate` | — | **admin (no mutations exist yet)** |
| `semesters` | `title`, `startDate`, `endDate`, `isActive`, `academicYearId?` | `by_isActive`, `by_academicYearId` | **admin (no mutations exist yet)** |
| `institutions` | `name`, `emailDomain` | — | admin (currently 1 seeded row: KTU) |
| `faculties` | `institutionId`, `name` | `by_institutionId` | **admin (no mutations exist yet)** |
| `departments` | `facultyId`, `name` | `by_facultyId` | **admin (no mutations exist yet)** |
| `programs` | `departmentId`, `name` | `by_departmentId` | **admin (no mutations exist yet)** |
| `academicClasses` | `programId`, `level`, `session` | `by_program_level_session` | **admin (no mutations exist yet)** |
| `divisions` | `academicClassId`, `label` | `by_academicClassId` | **admin (no mutations exist yet)** |
| `courses` | `semesterId`, `academicClassId`, `courseCode`, `courseTitle`, `colourTag` | `by_semesterId_and_academicClassId` | **admin (no mutations exist yet)** |
| `courseSections` | `courseId`, `divisionId?`, `scheduleDays`, `scheduleTime`, `venue?` | `by_courseId` | **admin (no mutations exist yet)** |
| `courseActivities` | `studentId`, `courseId`, `title`, `activityType` (`ASSIGNMENT\|QUIZ\|PROJECT\|EXAM`), `dueDate`, `priority`, `status`, `notes?` | `by_studentId`, `by_courseId` | **admin should own writes; existing `create`/`update`/`remove` are unauthenticated dead code — see Known gaps** |
| `semesterActivities` | `semesterId`, `title`, `description?`, `date` | `by_semesterId` | **admin (no mutations exist yet)** — always CRITICAL priority, institution-wide, non-dismissible |
| `personalReminders` | `userId`, `semesterId`, `title`, `description?`, `courseId?`, `dueDate`, `startTime`, `endTime?`, `priority`, `isCompleted` | `by_userId_and_semesterId` | student-owned — N/A to admin app |
| `reminders` | `studentId`, `entityId`, `entityType`, `scheduledFor`, `notificationId?` | `by_studentId`, `by_entityId` | student-owned — N/A to admin app |
| `studentProfiles` | `userId`, `facultyId`, `departmentId`, `programId`, `academicClassId`, `divisionId?`, `institutionalEmail`, `indexNumber`, `phoneNumber`, `lastSeenAlertsAt?` | `by_userId` | student self-service; **no admin-facing edit path exists** (e.g. correcting `indexNumber`) |
| `reminderPreferences` | `studentId`, `priority`, `intervals[]` | `by_studentId_and_priority` | student-owned — N/A to admin app |
| `notificationPreferences` | `studentId`, `pushEnabled`, `soundEnabled`, `calendarSyncEnabled` | `by_studentId` | student-owned — N/A to admin app |
| `alerts` | `userId`, `entityType`, `entityId`, `kind`, `title`, `subtitle`, `priority?`, `createdAt`, `isRead` | `by_userId`, `by_userId_entityId_kind` | student-owned — N/A to admin app |
| `pushTokens` | `userId`, `token`, `platform` (`ios\|android`), `updatedAt` | `by_userId`, `by_userId_and_token` | system-owned — N/A to admin app |

## Function inventory by file

**`academicStructure.ts`** — read-only queries for hierarchy browsing:
`listFaculties`, `listDepartmentsByFaculty`, `listProgramsByDepartment`,
`listLevelsByProgram`, `listSessionsByProgramAndLevel`,
`getClassByProgramLevelSession`, `getClassDetails`, `getFullHierarchy`,
`listDivisionsByClass`. **No write mutations exist yet** — the admin app's Hierarchy
tab needs write equivalents for all of Faculty→Division.

**`academicYears.ts`**: `getCurrentYearOverview` (query, ctx.auth-derived, student-
facing only).

**`admins.ts`**: `createAdminAccount` (internalAction, dashboard/CLI-only — creates an
admin user with `role`/`institutionId`/`emailVerificationTime` set directly, no
verification email needed). `setAdminFields` (internalMutation — patches
name/institutionId when re-running against an existing email; this is also the entire
"forgot admin password" story, since re-running `createAdminAccount` resets the
password). **Neither is client-callable.** This is how the first admin account the web
app logs in as gets created — via Convex dashboard/CLI, not a signup form.

**`alerts.ts`** — two unrelated concerns in one file: `listBySemester` (query,
semesterActivities passthrough — the ONE query in this file relevant to admin, as a
read reference); the rest (`listMine`, `create`, `createForUser`, `markRead`,
`markReadByEntity`, `markAllRead`, `remove`, `removeAll`) are the student Alerts-tab
feed, N/A to admin.

**`courseActivities.ts`** — ⚠️ mixed authorization state:
- `listForStudent` (query) and `updateStatus` (mutation, ctx.auth-derived — student's
  "mark complete") are student-facing, fine as-is.
- **`create` / `update` / `remove` (mutations) have NO auth check at all.** They predate
  the admin/student ownership split and nothing currently calls them. **Do not build the
  admin app's course-activity CRUD on top of these — replace them with
  `role === 'admin'`-checked equivalents.**
- `listOverduePending` (internalQuery) feeds the 15-minute overdue cron — leave as is.

**`activities.ts`**: `resolveById` (query) — polymorphic resolver, student-facing.

**`notificationPreferences.ts`**: `getPreferences`, `setPreferences` — student-owned,
N/A to admin.

**`seed.ts`** — all internal, dev-only, run via
`npx convex run seed:seedAll '{"iAmSure": true}'`: `seedInstitution`, `seedHierarchy`,
`seedAcademicYear`, `seedCourses`, `seedDemoStudent`/`seedDemoStudentData`,
`seedDemoAdmin`, `getInstitutionId`, `seedActivities`, `seedPastSemesterActivities`,
`seedDemoAlerts`, `seedAll` (orchestrator). Idempotent — natural-key lookup before
insert, never delete-then-recreate. **This file is the best reference for the exact
shape each admin-owned table expects** — read it before designing any admin form.

**`courseSections.ts`**: `getForStudentCourse` (query, student-facing, resolves by
division with undivided fallback). No write mutation yet.

**`studentProfiles.ts`**: `getMyProfile`, `createProfile`, `updatePhoneNumber`,
`updateInstitutionalEmail`, `updateDivision`, `updateAcademicHierarchy` — all
ctx.auth-derived, self-service only. `listAllUserIds` (internalQuery, push fan-out
target). `updateLastSeenAlertsAt`. **No admin-facing mutation exists on this table** —
flagged as a real gap, not solved anywhere.

**`reminders.ts`**: `getPreferences`/`setPreferences` (ctx.auth-derived, current
pattern); `listForStudent`/`record` (still take a `studentId` param — an acknowledged
TODO, not yet migrated). Student-facing, N/A to admin.

**`users.ts`**: `findUserIdByEmail` (internalQuery, shared by seed.ts/admins.ts),
`viewer` (query — current user incl. `role`/`institutionId`, the auth-gate's first
check — the admin web app's own login/role-check should call this same query),
`updateName` (mutation).

**`personalReminders.ts`**: `listMine`, `getMine`, `create`, `update`, `remove`,
`listOverduePending` (internalQuery), `toggleComplete` — all ctx.auth-derived,
entirely student-owned, N/A to admin.

**`semesters.ts`**: `getActive` (query) — the only function in this file. **No write
mutation yet** — admin app needs to add semester create/update/activate.

**`pushDelivery.ts`** (all internalAction, server-only): `sendPushToUser`,
`notifyNewEvent`. **Any admin "publish a semesterActivity" mutation must call
`notifyNewEvent` via `ctx.scheduler.runAfter(0, ...)` immediately after inserting the
row**, or students silently get no push for it — mutations can't make the outbound
HTTP call themselves, only actions can, which is why this is a scheduled follow-up
rather than an inline call.

**`overdueSweep.ts`**: `run` (internalAction) — the 15-minute cron's sweep logic. Not
relevant to admin writes.

**`pushTokens.ts`**: `registerPushToken`, `unregisterPushToken` (mutations,
ctx.auth-derived), `listForUser`/`removeToken` (internal, server-only). N/A to admin.

**`courses.ts`**: `listMyCourses` (query, student-facing only). No admin write yet.

**Non-function files**:
- `auth.config.ts` / `auth.ts` — Password provider, signup email-domain gate
  (`profile()` callback, `flow === 'signUp'` only), `institutionId` resolution
  (`afterUserCreatedOrUpdated` callback).
- `institutionDomains.ts` — `KNOWN_INSTITUTION_DOMAINS`, a static allowlist array. Add a
  domain here (and a matching `institutions` row) when onboarding a second institution —
  the two are kept in sync manually, not derived from each other.
- `ResendOTP.ts` — verification-email provider (needs `AUTH_RESEND_KEY` set).
- `crons.ts` — registers the 15-minute overdue sweep.
- `http.ts` — minimal, Convex Auth's own HTTP routes.

## Known gaps (what the admin app is actually for)

Everything marked **"admin (no mutations exist yet)"** in the schema table above — the
entire institutional hierarchy (institutions → faculties → departments → programs →
academicClasses → divisions), courses, courseSections, semesters, academicYears, and
semesterActivities — currently has **zero write mutations**, authenticated or
otherwise. This is the actual scope of the admin app: design and add
`role === 'admin'`-checked mutations for all of it.

The one exception is `courseActivities`, which already has `create`/`update`/`remove`
mutations, but they're unauthenticated dead code that predates the student/admin
ownership split — replace them, don't extend them.

`studentProfiles.indexNumber` is documented as "identity, routes through admin" in the
mobile app's domain docs, but no admin mutation to actually edit it exists anywhere yet
— if student-identity correction is in scope for this admin app, that mutation needs to
be designed from scratch.

## Security pattern to follow

Every mutation that writes admin-owned data must check `role === 'admin'` off the
**server-verified auth identity** (`getAuthUserId(ctx)` → look up the `users` row →
check `.role`), never trust a client-sent role or id. This mirrors the mobile app's own
rule for student-owned data (see its `AGENTS.md` "Security" section): client-side
gating is UX, the Convex function itself is the actual enforcement.

## Auth specifics for the web app

- Admin accounts are never self-service — only created via `admins.ts#createAdminAccount`
  (Convex dashboard/CLI). The web app should be **sign-in only** — no signup screen, no
  self-service password reset (re-running `createAdminAccount` against an existing email
  resets its password; that's the whole recovery story).
- Session storage needs its own web-appropriate adapter (localStorage or cookies) passed
  into `ConvexAuthProvider` — don't assume the mobile repo's `expo-secure-store` adapter
  is reusable.
- JWT signing keys are already provisioned per-deployment; the web app doesn't need its
  own, it just authenticates against the same deployment it's configured to point at.
