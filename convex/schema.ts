import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const priorityValidator = v.union(
  v.literal('CRITICAL'),
  v.literal('IMPORTANT'),
  v.literal('FLEXIBLE'),
);
export const activityStatusValidator = v.union(v.literal('PENDING'), v.literal('COMPLETED'));
// Shared by `reminders` and `alerts` — both tables reference "which owning table does
// entityId belong to" and use the same three values (matching the actual table names,
// not a separate snake_case vocabulary) so there's one entity-kind vocabulary in this
// schema, not two slightly-differently-spelled ones for two similar-purpose tables.
export const entityType = v.union(
  v.literal('courseActivities'),
  v.literal('semesterActivities'),
  v.literal('personalReminders'),
);
export const alertKindValidator = v.union(
  v.literal('REMINDER_FIRED'),
  v.literal('NEW_EVENT'),
  v.literal('OVERDUE'),
);

// Shared by academicClasses (defines it) and academicStructure.ts / studentProfiles.ts
// (query args that must accept exactly the same values).
export const sessionValidator = v.union(v.literal('REGULAR'), v.literal('WEEKEND'));

export default defineSchema({
  ...authTables,

  // Published by the separate Academic Admin app. Read-only from this app.
  semesters: defineTable({
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
  }).index('by_isActive', ['isActive']),

  // --- Institutional hierarchy. Admin-published, read-only from this app. ---
  // Institution -> Faculty -> Department -> Program -> academicClass (Level+Session)
  // -> Division (optional). See AGENTS.md for the full model and why courses carry
  // academicClassId while schedule lives on the separate courseSections table.

  // Single row for now (Koforidua Technical University). Queries read the name/
  // emailDomain from here rather than hardcoding them, so it's a one-row edit if
  // either is ever wrong or a second institution is ever onboarded.
  institutions: defineTable({
    name: v.string(),
    emailDomain: v.string(),
  }),

  faculties: defineTable({
    institutionId: v.id('institutions'),
    name: v.string(),
  }).index('by_institutionId', ['institutionId']),

  departments: defineTable({
    facultyId: v.id('faculties'),
    name: v.string(),
  }).index('by_facultyId', ['facultyId']),

  programs: defineTable({
    departmentId: v.id('departments'),
    name: v.string(),
  }).index('by_departmentId', ['departmentId']),

  // A specific Program+Level+Session combination — what a student actually belongs to
  // and what a course is scheduled against. The compound index both enforces the
  // natural uniqueness of that triple and is the reverse lookup used to resolve the
  // Profile Setup picker chain (Program -> Level -> Session -> this row's _id).
  academicClasses: defineTable({
    programId: v.id('programs'),
    level: v.number(),
    session: sessionValidator,
  }).index('by_program_level_session', ['programId', 'level', 'session']),

  // Optional subdivision of an academicClass (A-E). A class with none simply has zero
  // rows here — see listDivisionsByClass in academicStructure.ts.
  divisions: defineTable({
    academicClassId: v.id('academicClasses'),
    label: v.string(),
  }).index('by_academicClassId', ['academicClassId']),

  // Published by the separate Academic Admin app. Read-only from this app.
  courses: defineTable({
    semesterId: v.id('semesters'),
    academicClassId: v.id('academicClasses'),
    courseCode: v.string(),
    courseTitle: v.string(),
    colourTag: v.string(),
  }).index('by_semesterId_and_academicClassId', ['semesterId', 'academicClassId']),

  // Published by the separate Academic Admin app. Read-only from this app. Schedule
  // (day/time/venue) varies by division; course activities below don't — that's why
  // schedule lives here rather than on courses or courseActivities.
  courseSections: defineTable({
    courseId: v.id('courses'),
    divisionId: v.optional(v.id('divisions')),
    scheduleDays: v.array(v.string()),
    scheduleTime: v.string(),
    venue: v.optional(v.string()),
  }).index('by_courseId', ['courseId']),

  // Owned by this app. Assignments, quizzes, projects, and exams all live in one entity.
  courseActivities: defineTable({
    studentId: v.id('users'),
    courseId: v.id('courses'),
    title: v.string(),
    activityType: v.union(
      v.literal('ASSIGNMENT'),
      v.literal('QUIZ'),
      v.literal('PROJECT'),
      v.literal('EXAM'),
    ),
    dueDate: v.number(),
    priority: priorityValidator,
    status: activityStatusValidator,
    notes: v.optional(v.string()),
  })
    .index('by_studentId', ['studentId'])
    .index('by_courseId', ['courseId']),

  // Admin-published institutional events (registration, exam periods, campus events).
  // Always CRITICAL priority and non-dismissible. Read-only from this app. Institution-
  // wide, not scoped to an academicClass — confirmed intentional.
  semesterActivities: defineTable({
    semesterId: v.id('semesters'),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
  }).index('by_semesterId', ['semesterId']),

  // Owned by this app — the student's primary creative surface. This is a REMINDER
  // platform, not a task manager: students never create courseActivities (admin owns
  // those, see above), they only ever create personalReminders — study blocks, prep
  // sessions, life admin, anything they want to nudge themselves about. Optionally tied
  // to a course for context/colour-coding (validated against the student's own
  // academicClass on insert, see personalReminders.ts), but never admin-managed.
  // `userId`, not `studentId` like its sibling tables — deliberate, matches authTables'
  // own `users` naming directly since this table's ownership model (every query scoped
  // to the caller's identity, never a client-passed id) is the load-bearing property.
  // No visibility/sharing field yet (class-rep sharing is a real future want, not built
  // for this MVP) — kept off the schema entirely rather than stubbed, so adding it later
  // is a plain additive migration, not a rename.
  personalReminders: defineTable({
    userId: v.id('users'),
    semesterId: v.id('semesters'),
    title: v.string(),
    description: v.optional(v.string()),
    courseId: v.optional(v.id('courses')),
    dueDate: v.number(),
    startTime: v.number(),
    // If present, this is a time-range reminder (e.g. a study block); if absent, it's a
    // single-moment reminder. Either way, the actual notification fires relative to
    // startTime, never endTime — the end is display context for the student ("until
    // 8pm"), not a second trigger.
    endTime: v.optional(v.number()),
    priority: priorityValidator,
    isCompleted: v.boolean(),
  }).index('by_userId_and_semesterId', ['userId', 'semesterId']),

  // A scheduled local-notification job, tied to any of the entities above via
  // entityId/entityType. Scheduling itself happens on-device via expo-notifications;
  // this table just records what was scheduled so it can be looked up/cancelled.
  reminders: defineTable({
    studentId: v.id('users'),
    entityId: v.string(),
    entityType,
    scheduledFor: v.number(),
    notificationId: v.optional(v.string()),
  })
    .index('by_studentId', ['studentId'])
    .index('by_entityId', ['entityId']),

  // Owned by this app. One row per student, created during onboarding — its absence
  // for the signed-in user IS the "needs profile setup" gate state, see
  // hooks/use-auth-gate.ts. facultyId/departmentId/programId are denormalized here
  // even though they're derivable by walking up from academicClassId: every dashboard/
  // list query that needs "which faculty is this student in" would otherwise need a
  // 3-hop join through academicClasses -> programs -> departments on every call. Keep
  // this redundancy — don't "clean it up" without re-introducing that cost.
  studentProfiles: defineTable({
    userId: v.id('users'),
    facultyId: v.id('faculties'),
    departmentId: v.id('departments'),
    programId: v.id('programs'),
    academicClassId: v.id('academicClasses'),
    divisionId: v.optional(v.id('divisions')),
    institutionalEmail: v.string(),
    indexNumber: v.string(),
    phoneNumber: v.string(),
    // When useAlertsSync last checked semesterActivities for rows to turn into
    // NEW_EVENT alerts (see convex/alerts.ts and hooks/useAlertsSync.ts) — absence
    // means "never checked," not "checked at time zero," so the first sync after a
    // student's profile is created doesn't retroactively alert on the entire existing
    // catalogue of institutional events.
    lastSeenAlertsAt: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  // Owned by this app. One row per (student, priority) — how far ahead of a due date
  // to fire local reminders for that priority tier. Settings' reminder-timing rows read
  // and write this; absence of a row for a given priority means "use the shipped
  // default," not "no reminders" — see DEFAULT_INTERVALS_MINUTES in
  // lib/reminderIntervals.ts.
  reminderPreferences: defineTable({
    studentId: v.id('users'),
    priority: priorityValidator,
    intervals: v.array(v.number()),
  }).index('by_studentId_and_priority', ['studentId', 'priority']),

  // Owned by this app. One row per student for the Settings screen's device-level
  // toggles (push/sound/calendar sync) — distinct from reminderPreferences above, which
  // is about per-priority timing, not whether notifications fire at all.
  notificationPreferences: defineTable({
    studentId: v.id('users'),
    pushEnabled: v.boolean(),
    soundEnabled: v.boolean(),
    calendarSyncEnabled: v.boolean(),
  }).index('by_studentId', ['studentId']),

  // Owned by this app — the Alerts tab's feed. A client-derived log, not real OS push
  // notifications (see AGENTS.md's Alerts feed section): entries are written by
  // hooks/useAlertsSync.ts, the one place all three creation points (REMINDER_FIRED,
  // NEW_EVENT, OVERDUE) live, never scattered across screens. `by_userId_entityId_kind`
  // exists purely for the dedup check useAlertsSync does before every insert — the same
  // (user, entity, kind) triple should only ever produce one alert, not one per sync
  // pass.
  //
  // `title`/`subtitle`/`priority` are frozen at creation time, not re-derived from
  // entityId on every read — a live join across three different tables would go stale
  // the instant a relative-time message ("due in 3 hours") was created, and would break
  // outright if the referenced entity is later edited or deleted. Same behavior any
  // real push notification already has: the content you received is what it said at
  // send time, not a live view of current state. `priority` is optional — only
  // REMINDER_FIRED/OVERDUE alerts have one (it colours ActivityCard-style icon wells
  // the same way ActivityCard/PriorityBadge do); NEW_EVENT has no priority concept.
  alerts: defineTable({
    userId: v.id('users'),
    entityType,
    entityId: v.string(),
    kind: alertKindValidator,
    title: v.string(),
    subtitle: v.string(),
    priority: v.optional(priorityValidator),
    createdAt: v.number(),
    isRead: v.boolean(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_entityId_kind', ['userId', 'entityId', 'kind']),

  // Owned by this app — one row per (student, device). A student logged in on two
  // devices gets two rows, not one overwritten row; convex/pushTokens.ts upserts by the
  // exact (userId, token) pair, never by userId alone, so registering a second device
  // never evicts the first. Read only by convex/pushDelivery.ts's sendPushToUser action
  // (an internalQuery, never exposed to clients — see AGENTS.md's Security section for
  // why "a client only ever sees its own data" isn't the same guarantee as "the server
  // never hands another user's tokens to anyone").
  pushTokens: defineTable({
    userId: v.id('users'),
    token: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android')),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_token', ['userId', 'token']),
});
