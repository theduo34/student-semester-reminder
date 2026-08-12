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

// Every user is exactly one of these — there's no third role in this MVP (see
// AGENTS.md's Admin account section). Students get "student" via the register flow's
// own profile() callback (convex/auth.ts); admins only ever get "admin" via
// convex/admins.ts's createAdminAccount, an internalAction with no public
// equivalent — there is no client-facing "become an admin" path anywhere in this app.
export const userRoleValidator = v.union(v.literal('student'), v.literal('admin'));

export default defineSchema({
  ...authTables,
  // Extends (not replaces) authTables' own `users` table — the documented
  // @convex-dev/auth pattern for adding fields to the auth-managed table rather than
  // fighting the library with a parallel table. `role` and `institutionId` live here,
  // not on a separate adminProfiles table: this is a single-institution MVP (see
  // AGENTS.md), so one extra column costs nothing extra to join, and the routing
  // guard already reads this same `users` row for every other gate decision.
  users: defineTable({
    ...authTables.users.validator.fields,
    role: userRoleValidator,
    // Set for every user, both roles, now — not admin-only. Admins get it explicitly
    // from convex/admins.ts#createAdminAccount; students get it resolved from their
    // signup email's domain (convex/institutionDomains.ts's static allowlist +
    // convex/auth.ts's afterUserCreatedOrUpdated callback, since the domain check
    // itself runs in a synchronous, DB-less context and can only validate the domain,
    // not look up the real institutions._id). Still optional because Convex can't
    // backfill a newly-added field onto rows that predate it (a demo/dev account
    // created before this field existed) — anywhere this is read, treat "unset" as
    // "assume the sole/original institution," never crash on it.
    institutionId: v.optional(v.id('institutions')),
  })
    .index('email', ['email'])
    .index('phone', ['phone']),

  // Groups exactly two semesters into one academic year (see AGENTS.md) — the grouping
  // unit behind Home's Academic Year Progress card/detail screen. Admin-published,
  // read-only queries only, same status as semesters/courses below.
  academicYears: defineTable({
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  }),

  // Admin-published (the (admin) route group's Publish tab, once built — see
  // AGENTS.md's Admin account section). Read-only queries only, as of this pass.
  semesters: defineTable({
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    // Which academicYears row this semester belongs to. Optional because it was added
    // after semesters already existed in this schema — a semester without one predates
    // the concept and simply can't be grouped into an Academic Year Progress view (see
    // convex/academicYears.ts), it's still fully usable everywhere else (getActive,
    // course/activity scoping, ...).
    academicYearId: v.optional(v.id('academicYears')),
    // 'auto' (or unset — every pre-existing row predates this field): eligible to be
    // reassigned by the hourly active-semester sync (semesters.ts#syncActiveSemester)
    // whenever `now` moves outside this row's own [startDate, endDate]. 'manual':
    // admin explicitly pinned this semester active via setActiveSemester — the sync
    // leaves it alone regardless of dates, until admin picks a different one. Only
    // meaningful on whichever row currently has isActive: true.
    activeMode: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
  })
    .index('by_isActive', ['isActive'])
    .index('by_academicYearId', ['academicYearId']),

  // --- Institutional hierarchy. Admin-published; writes are admin-only (requireAdmin,
  // see convex/adminAuth.ts), reads are open to any signed-in caller. ---
  // Institution -> Faculty -> Department -> Program -> academicClass (Level+Session)
  // -> Division (optional). See AGENTS.md for the full model and why courses carry
  // academicClassId while schedule lives on the separate courseSections table.

  // Single row for now (Koforidua Technical University). Queries read the name/
  // emailDomain from here rather than hardcoding them, so it's a one-row edit if
  // either is ever wrong or a second institution is ever onboarded. No admin mutation
  // for name/emailDomain yet — creating a second institution is still a manual
  // seed/dashboard edit. logoStorageId is admin-editable (see convex/institutions.ts)
  // — a Convex file storage reference, optional since most institutions won't set one
  // immediately after being seeded.
  institutions: defineTable({
    name: v.string(),
    emailDomain: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
  }),

  // Admin CRUD: academicStructure.ts's createFaculty/updateFaculty/removeFaculty.
  faculties: defineTable({
    institutionId: v.id('institutions'),
    name: v.string(),
  }).index('by_institutionId', ['institutionId']),

  // Admin CRUD: academicStructure.ts's createDepartment/updateDepartment/removeDepartment.
  departments: defineTable({
    facultyId: v.id('faculties'),
    name: v.string(),
  }).index('by_facultyId', ['facultyId']),

  // Admin CRUD: academicStructure.ts's createProgram/updateProgram/removeProgram.
  programs: defineTable({
    departmentId: v.id('departments'),
    name: v.string(),
  }).index('by_departmentId', ['departmentId']),

  // A specific Program+Level+Session combination — what a student actually belongs to
  // and what a course is scheduled against. The compound index both enforces the
  // natural uniqueness of that triple and is the reverse lookup used to resolve the
  // Profile Setup picker chain (Program -> Level -> Session -> this row's _id).
  // Admin CRUD: academicStructure.ts's createAcademicClass/updateAcademicClass/
  // removeAcademicClass — update/remove are both blocked once anything downstream
  // (divisions/courses/studentProfiles) references the row, see that file.
  academicClasses: defineTable({
    programId: v.id('programs'),
    level: v.number(),
    session: sessionValidator,
  }).index('by_program_level_session', ['programId', 'level', 'session']),

  // Optional subdivision of an academicClass (A-E). A class with none simply has zero
  // rows here — see listDivisionsByClass in academicStructure.ts. Admin CRUD:
  // createDivision/updateDivision/removeDivision in the same file.
  divisions: defineTable({
    academicClassId: v.id('academicClasses'),
    label: v.string(),
  }).index('by_academicClassId', ['academicClassId']),

  // Admin-published (the (admin) route group's Courses tab, once built). Read-only
  // queries only, as of this pass.
  courses: defineTable({
    semesterId: v.id('semesters'),
    academicClassId: v.id('academicClasses'),
    courseCode: v.string(),
    courseTitle: v.string(),
    colourTag: v.string(),
  })
    .index('by_semesterId_and_academicClassId', ['semesterId', 'academicClassId'])
    // Every course in a class regardless of semester — courseActivities.ts's
    // listForStudent needs "all my courses across any semester I've ever been
    // enrolled for," which the compound index above can't serve on its own since
    // semesterId is its required prefix key.
    .index('by_academicClassId', ['academicClassId']),

  // Admin-published, read-only queries only as of this pass (same as courses above).
  // Schedule (day/time/venue) varies by division; course activities below don't —
  // that's why schedule lives here rather than on courses or courseActivities.
  courseSections: defineTable({
    courseId: v.id('courses'),
    divisionId: v.optional(v.id('divisions')),
    scheduleDays: v.array(v.string()),
    scheduleTime: v.string(),
    venue: v.optional(v.string()),
    // Optional — populated by the timetable-import path (documentImport.ts's
    // parseCourseTimetable + courses.ts's importCourseTimetable); a section created
    // through the manual "Add course" path may not set it. Additive field, not a
    // rename — same posture as every other optional field added after its table
    // already had rows (see e.g. semesters.academicYearId's own comment).
    lecturer: v.optional(v.string()),
  }).index('by_courseId', ['courseId']),

  // Admin-owned and shared: ONE row per activity, published once regardless of how
  // many students are enrolled in the course — assignments, quizzes, projects, and
  // exams all live in this one entity. Completion is per-student and lives on a
  // separate table (courseActivityCompletions, below) rather than on this row, for two
  // reasons: (1) this row previously carried `studentId` + `status` directly, which
  // meant seed.ts had to insert one full duplicate row per enrolled student for the
  // same assignment — the exact thing "admin-owned, shared across the class" (see
  // AGENTS.md) was supposed to mean but the data never actually was; (2) a shared row
  // means a student who joins the class after an activity is published still sees it —
  // visibility is computed at read time from the student's academicClassId matching
  // the course's, never from a per-student row existing. See
  // convex/courseActivities.ts#resolveCourseActivitiesForStudent for the read-side join.
  courseActivities: defineTable({
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
    notes: v.optional(v.string()),
    // TEMPORARY, migration-only — see convex/cleanupLegacyCourseActivities.ts. Existing
    // rows on the dev deployment still carry these from before this table became a
    // shared definition row; Convex schema validation rejects undeclared extra fields
    // outright, so they have to be declared optional here just long enough to run a
    // one-off cleanup mutation, then removed again. Never write to these going forward.
    studentId: v.optional(v.id('users')),
    status: v.optional(activityStatusValidator),
    // Denormalized from courseId's own course — a courseActivity has no natural
    // "every activity in this semester" index otherwise (courseId -> course ->
    // semesterId is a two-hop join Convex can't paginate through directly). Optional
    // because it was added after rows already existed — same posture as every other
    // backfill-gap field in this schema (see e.g. semesters.academicYearId's own
    // comment); rows that predate it simply won't surface in semester-scoped admin
    // reads.
    semesterId: v.optional(v.id('semesters')),
    // Which 'exams'-kind activityCategories row this EXAM activity was published
    // under (see that table's own comment) — set by
    // courseActivities.ts#importExamTimetable, the only writer of EXAM-type rows.
    // Non-EXAM activityTypes never set this; an admin-created category only ever
    // holds one kind of thing. Optional for the same backfill-gap reason as
    // semesterId above.
    categoryId: v.optional(v.id('activityCategories')),
  })
    .index('by_courseId', ['courseId'])
    .index('by_categoryId', ['categoryId'])
    .index('by_semesterId', ['semesterId'])
    // Lets "uncategorized EXAM rows in this one semester" be a real indexed,
    // paginated query (Convex indexes accept `undefined` as a real key component —
    // matches rows where categoryId was never set — see courses.ts#importExamTimetable
    // and the Publish page's Uncategorized view) instead of a full-table scan filtered
    // in memory.
    .index('by_semesterId_and_categoryId', ['semesterId', 'categoryId']),

  // One row per (courseActivity, student) — created/patched only when a student
  // actually marks something complete (courseActivities.ts#updateStatus). Absence of a
  // row for a given (courseActivityId, studentId) pair means PENDING, the default, so
  // publishing an activity never requires fanning out a row per enrolled student.
  courseActivityCompletions: defineTable({
    courseActivityId: v.id('courseActivities'),
    studentId: v.id('users'),
    status: activityStatusValidator,
  })
    .index('by_studentId_courseActivityId', ['studentId', 'courseActivityId'])
    .index('by_studentId', ['studentId'])
    .index('by_courseActivityId', ['courseActivityId']),

  // Admin-created buckets for organizing what gets published under a semester on the
  // admin Publish page — every category lives under exactly one semester (a new
  // semester starts with none, admin creates what it needs), chosen from the
  // Publish page's Year/Semester pickers.
  //
  // 'kind' is fixed at creation and never changes after (enforced in
  // activityCategories.ts#updateCategory, which simply doesn't accept it as a
  // patchable field): 'general' categories hold plain title/date/description rows
  // (semesterActivities, tagged by categoryId) — Academic Calendar is the
  // motivating example, but admin can create as many as they want, named however.
  // 'exams' categories hold EXAM-type courseActivities instead (tagged by
  // categoryId too, see that table's own comment) — these need real course-code
  // matching against courses/courseSections (Teaching Timetable), which a plain
  // title/date/description row can't hold, so they're a structurally different kind
  // of category rather than a flag on the same data. Teaching Timetable itself still
  // isn't a category at all — it creates whole courses/classes, not just activities,
  // and stays on its own Courses page.
  activityCategories: defineTable({
    semesterId: v.id('semesters'),
    name: v.string(),
    description: v.optional(v.string()),
    // Optional only so any category row created before this field existed (this same
    // session, before kind was added) doesn't fail schema validation — every category
    // created going forward always has one (createCategory requires it), and every
    // reader treats an unset kind as 'general', the type every category was before
    // 'exams' existed.
    kind: v.optional(v.union(v.literal('general'), v.literal('exams'))),
  }).index('by_semesterId', ['semesterId']),

  // Admin-published institutional events (registration, exam periods, campus events).
  // Always CRITICAL priority and non-dismissible. Read-only from this app. Institution-
  // wide, not scoped to an academicClass — confirmed intentional.
  semesterActivities: defineTable({
    semesterId: v.id('semesters'),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    // Optional — added after this table already had rows (the pre-category-system
    // Academic Calendar import), same backfill-gap posture as every other optional
    // field added later in this schema. A row with no category simply doesn't appear
    // under any category's own listing (convex/semesterActivities.ts
    // #listActivitiesByCategoryPaginated) — it still shows on the semester-wide views
    // that read by semesterId directly (the semester detail page).
    categoryId: v.optional(v.id('activityCategories')),
  })
    .index('by_semesterId', ['semesterId'])
    .index('by_categoryId', ['categoryId'])
    // Same "uncategorized rows in this one semester, as a real indexed paginated
    // query" reasoning as courseActivities' own by_semesterId_and_categoryId index.
    .index('by_semesterId_and_categoryId', ['semesterId', 'categoryId']),

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
  })
    .index('by_userId', ['userId'])
    // Which students belong to a given academicClass — needed to resolve "who's
    // enrolled in this course" from the other direction (course -> academicClassId ->
    // students), e.g. convex/courseActivities.ts's listOverduePending fanning an
    // overdue courseActivity out to every enrolled student who hasn't completed it.
    .index('by_academicClassId', ['academicClassId']),

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
