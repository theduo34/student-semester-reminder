import { getAuthUserId } from '@convex-dev/auth/server';
import { paginationOptsValidator } from 'convex/server';
import { Infer, v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { internalQuery, mutation, MutationCtx, query, QueryCtx } from './_generated/server';
import { requireAdmin } from './adminAuth';
import { activityStatusValidator, priorityValidator } from './schema';

const activityTypeValidator = v.union(
  v.literal('ASSIGNMENT'),
  v.literal('QUIZ'),
  v.literal('PROJECT'),
  v.literal('EXAM'),
);

export type CourseActivityWithStatus = Doc<'courseActivities'> & {
  status: Infer<typeof activityStatusValidator>;
};

// Shared read-side join: definition rows (admin-owned, one per activity, see
// schema.ts's comment on courseActivities) plus this one student's own completion
// state, merged into the same combined shape the old per-student-row table used to
// return directly — every client consumer (lib/activityMapping.ts, hooks/
// useAlertsSync.ts, the activity/[entityId] screen) reads `activity.status` off the
// result exactly as before, so none of them needed to change for this migration.
// `courseIds` is the caller's job to resolve (listForStudent wants every course the
// student's ever had access to; academicYears.ts wants one semester's course set) —
// this helper only handles the completion merge, not enrollment scoping.
export async function resolveCourseActivitiesForStudent(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<'users'>,
  courseIds: Set<Id<'courses'>>,
): Promise<CourseActivityWithStatus[]> {
  if (courseIds.size === 0) {
    return [];
  }
  const activitiesPerCourse = await Promise.all(
    [...courseIds].map((courseId) =>
      ctx.db
        .query('courseActivities')
        .withIndex('by_courseId', (q) => q.eq('courseId', courseId))
        .collect(),
    ),
  );
  const activities = activitiesPerCourse.flat();

  const completions = await ctx.db
    .query('courseActivityCompletions')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect();
  const completedIds = new Set(
    completions.filter((completion) => completion.status === 'COMPLETED').map((completion) => completion.courseActivityId),
  );

  return activities.map((activity) => ({
    ...activity,
    status: completedIds.has(activity._id) ? ('COMPLETED' as const) : ('PENDING' as const),
  }));
}

// TODO: still takes an explicit studentId rather than deriving it from ctx.auth (see
// AGENTS.md's Security section) — predates the ownership-derivation pattern everywhere
// else in this app and is called from screens that already only ever pass the caller's
// own id, so it's a real gap, just not a new one introduced by this pass.
export const listForStudent = query({
  args: { studentId: v.id('users') },
  handler: async (ctx, { studentId }) => {
    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', studentId))
      .unique();
    if (profile === null) {
      return [];
    }
    const courses = await ctx.db
      .query('courses')
      .withIndex('by_academicClassId', (q) => q.eq('academicClassId', profile.academicClassId))
      .collect();
    return resolveCourseActivitiesForStudent(ctx, studentId, new Set(courses.map((course) => course._id)));
  },
});

// The actual "publish an activity" mutation — requireAdmin-gated, same pattern as
// academicStructure.ts's admin CRUD (see convex/adminAuth.ts). One insert regardless
// of how many students are enrolled in the course; every enrolled student sees it the
// next time listForStudent resolves their course set, no fan-out required.
export const create = mutation({
  args: {
    courseId: v.id('courses'),
    title: v.string(),
    activityType: activityTypeValidator,
    dueDate: v.number(),
    priority: priorityValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const course = await ctx.db.get(args.courseId);
    if (course === null) {
      throw new Error('Course not found');
    }
    return ctx.db.insert('courseActivities', { ...args, semesterId: course.semesterId });
  },
});

// The Exams/Resit import's write side (see documentImport.ts#parseExamTimetable +
// courseActivities.ts#importExamTimetable for the read/mapping side that calls this) —
// mirrors semesterActivities.ts#createSemesterActivitiesBulk's shape and its same
// "no push per row" reasoning: a whole exam timetable published at once shouldn't
// burst-notify every affected student.
export const createBulk = mutation({
  args: { activities: v.array(v.object({
    courseId: v.id('courses'),
    title: v.string(),
    activityType: activityTypeValidator,
    dueDate: v.number(),
    priority: priorityValidator,
    notes: v.optional(v.string()),
  })) },
  handler: async (ctx, { activities }) => {
    await requireAdmin(ctx);
    const courseCache = new Map<Id<'courses'>, Id<'semesters'> | undefined>();
    return await Promise.all(
      activities.map(async (activity) => {
        if (!courseCache.has(activity.courseId)) {
          const course = await ctx.db.get(activity.courseId);
          courseCache.set(activity.courseId, course?.semesterId);
        }
        return ctx.db.insert('courseActivities', { ...activity, semesterId: courseCache.get(activity.courseId) });
      }),
    );
  },
});

// The semester detail page's week-by-week overview (see semesterActivities.ts
// #listBySemesterPaginated for the general-category counterpart) — every EXAM-type
// activity across every 'exams'-kind category in one semester, real cursor
// pagination. The activityType filter runs within each fetched page (Convex's
// documented behavior for a filtered paginated query — a page can come back with
// fewer than numItems if non-EXAM rows are interspersed, which is correct, not a bug).
export const listExamsBySemesterPaginated = query({
  args: { semesterId: v.id('semesters'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { semesterId, paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('courseActivities')
      .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
      .order('asc')
      .filter((q) => q.eq(q.field('activityType'), 'EXAM'))
      .paginate(paginationOpts);
  },
});

// The Publish page's 'exams'-kind category detail view — real cursor pagination via
// the categoryId every EXAM row is tagged with at write time (see that field's own
// schema.ts comment). Doesn't join course code/title — title already carries the
// course code (see importExamTimetable's `${row.courseCode} exam`), and a per-row
// course lookup here would defeat the point of paginating in the first place.
export const listExamsByCategoryPaginated = query({
  args: { categoryId: v.id('activityCategories'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { categoryId, paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('courseActivities')
      .withIndex('by_categoryId', (q) => q.eq('categoryId', categoryId))
      .order('asc')
      .paginate(paginationOpts);
  },
});

// The Publish page's Uncategorized view, exam half — real cursor pagination via the
// compound (semesterId, categoryId) index, matching EXAM rows where categoryId was
// never set. Non-EXAM courseActivities never had a categoryId to begin with (only
// importExamTimetable sets one), so the activityType filter here is really just
// excluding a table that happens to share storage, not filtering "real" candidates.
export const listUncategorizedExamsBySemesterPaginated = query({
  args: { semesterId: v.id('semesters'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { semesterId, paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('courseActivities')
      .withIndex('by_semesterId_and_categoryId', (q) => q.eq('semesterId', semesterId).eq('categoryId', undefined))
      .order('asc')
      .filter((q) => q.eq(q.field('activityType'), 'EXAM'))
      .paginate(paginationOpts);
  },
});

// Cheap existence check for the Publish page's Uncategorized tile — a single indexed
// read, not a count.
export const hasUncategorizedExams = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query('courseActivities')
      .withIndex('by_semesterId_and_categoryId', (q) => q.eq('semesterId', semesterId).eq('categoryId', undefined))
      .filter((q) => q.eq(q.field('activityType'), 'EXAM'))
      .first();
    return row !== null;
  },
});

const examRowFields = {
  courseCode: v.string(),
  courseTitle: v.string(),
  examDate: v.number(),
  venue: v.optional(v.string()),
  isResit: v.boolean(),
};

// The write side of the Exams/Resit import (see documentImport.ts#parseExamTimetable
// for the read/extraction side — that action never writes to the database itself).
// Unlike importCourseTimetable (courses.ts), this resolves purely by courseCode
// against every course already published for the semester, not one admin-mapped
// academicClass at a time — the source document's own "class" column is frequently
// under-specified (a resit's class often carries no level number, e.g. "HND ACCT"
// rather than "HND ACCT 2", since a resit isn't necessarily tied to a student's
// current level — confirmed by reading the actual sample document), so forcing a
// single class mapping per group the way the teaching-timetable import does would
// silently fail to resolve rows that belong to a different level of the same program.
// A course code is otherwise unique per semester (distinct prefixes per program in
// practice), so a flat semester-wide lookup is both simpler and more correct here.
// Unmatched codes are skipped and reported back rather than failing the whole batch —
// the admin fixes the source row (a typo'd code) or accepts the course genuinely
// hasn't been published yet (Teaching Timetable import runs first, normally).
export const importExamTimetable = mutation({
  args: {
    categoryId: v.id('activityCategories'),
    rows: v.array(v.object(examRowFields)),
  },
  handler: async (ctx, { categoryId, rows }) => {
    await requireAdmin(ctx);

    const category = await ctx.db.get(categoryId);
    if (category === null) {
      throw new Error('Category not found');
    }
    const semesterId = category.semesterId;

    const courses = await ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) => q.eq('semesterId', semesterId))
      .collect();
    const courseIdByCode = new Map(courses.map((course) => [course.courseCode, course._id]));

    const unmatchedCourseCodes: string[] = [];
    const toInsert: {
      courseId: Id<'courses'>;
      semesterId: Id<'semesters'>;
      categoryId: Id<'activityCategories'>;
      title: string;
      activityType: 'EXAM';
      dueDate: number;
      priority: 'CRITICAL';
      notes?: string;
    }[] = [];

    for (const row of rows) {
      const courseId = courseIdByCode.get(row.courseCode);
      if (courseId === undefined) {
        unmatchedCourseCodes.push(row.courseCode);
        continue;
      }
      const noteParts = [row.isResit ? 'Resit exam' : undefined, row.venue].filter(
        (part): part is string => part !== undefined,
      );
      toInsert.push({
        courseId,
        semesterId,
        categoryId,
        title: `${row.courseCode} exam`,
        activityType: 'EXAM',
        dueDate: row.examDate,
        priority: 'CRITICAL',
        notes: noteParts.length > 0 ? noteParts.join(' — ') : undefined,
      });
    }

    const insertedIds = await Promise.all(
      toInsert.map((activity) => ctx.db.insert('courseActivities', activity)),
    );

    return { published: insertedIds.length, unmatchedCourseCodes };
  },
});

export const update = mutation({
  args: {
    activityId: v.id('courseActivities'),
    title: v.optional(v.string()),
    activityType: v.optional(activityTypeValidator),
    dueDate: v.optional(v.number()),
    priority: v.optional(priorityValidator),
    notes: v.optional(v.string()),
    // Lets the Publish page's Uncategorized view assign an orphaned EXAM row (one
    // with no categoryId — predates the category system, e.g. seed.ts's inserts,
    // which write directly and don't set it) to a real 'exams'-kind category.
    // Omitted (not just undefined) leaves the row wherever it already is — same
    // "optional field means don't touch it" convention updateSemesterActivity uses.
    categoryId: v.optional(v.id('activityCategories')),
  },
  handler: async (ctx, { activityId, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(activityId, patch);
  },
});

export const remove = mutation({
  args: { activityId: v.id('courseActivities') },
  handler: async (ctx, { activityId }) => {
    await requireAdmin(ctx);
    // No cascade delete in Convex — clean up every student's completion row for this
    // activity manually, or they'd be dead references pointing at a deleted document.
    const completions = await ctx.db
      .query('courseActivityCompletions')
      .withIndex('by_courseActivityId', (q) => q.eq('courseActivityId', activityId))
      .collect();
    await Promise.all(completions.map((completion) => ctx.db.delete(completion._id)));
    await ctx.db.delete(activityId);
  },
});

// System-only — read by convex/overdueSweep.ts's cron. Full-table scan over
// courseActivities, plus a students-by-academicClass + completions-by-activity query
// per overdue activity: fine at this app's demo scale (a handful of activities, a
// handful of enrolled students), same "flagged not fixed" posture as
// academicStructure.ts's own dependent-row scans — not something that'd hold up at
// real scale.
export const listOverduePending = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const activities = await ctx.db.query('courseActivities').collect();
    const overdueActivities = activities.filter((activity) => activity.dueDate < now);

    const results: {
      _id: Id<'courseActivities'>;
      studentId: Id<'users'>;
      title: string;
      priority: Infer<typeof priorityValidator>;
      courseLabel: string;
    }[] = [];

    for (const activity of overdueActivities) {
      const course = await ctx.db.get(activity.courseId);
      if (course === null) continue;

      const [enrolledStudents, completions] = await Promise.all([
        ctx.db
          .query('studentProfiles')
          .withIndex('by_academicClassId', (q) => q.eq('academicClassId', course.academicClassId))
          .collect(),
        ctx.db
          .query('courseActivityCompletions')
          .withIndex('by_courseActivityId', (q) => q.eq('courseActivityId', activity._id))
          .collect(),
      ]);
      const completedStudentIds = new Set(
        completions.filter((completion) => completion.status === 'COMPLETED').map((completion) => completion.studentId),
      );
      const courseLabel = `${course.courseCode} — ${course.courseTitle}`;

      for (const student of enrolledStudents) {
        if (completedStudentIds.has(student.userId)) continue;
        results.push({
          _id: activity._id,
          studentId: student.userId,
          title: activity.title,
          priority: activity.priority,
          courseLabel,
        });
      }
    }

    return results;
  },
});

// The one write a student actually makes against admin-owned data (the Activity
// Details screen's Mark complete button) — ctx.auth-derived, ownership checked via
// "does this activity's course belong to my own academicClass" rather than a stored
// studentId (there isn't one on this table anymore, see schema.ts). Upserts into
// courseActivityCompletions instead of patching the definition row directly.
export const updateStatus = mutation({
  args: { activityId: v.id('courseActivities'), status: activityStatusValidator },
  handler: async (ctx, { activityId, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const activity = await ctx.db.get(activityId);
    if (activity === null) {
      throw new Error('Activity not found');
    }
    const course = await ctx.db.get(activity.courseId);
    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
    if (course === null || profile === null || course.academicClassId !== profile.academicClassId) {
      throw new Error('Activity not found');
    }

    const existing = await ctx.db
      .query('courseActivityCompletions')
      .withIndex('by_studentId_courseActivityId', (q) =>
        q.eq('studentId', userId).eq('courseActivityId', activityId),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { status });
    } else {
      await ctx.db.insert('courseActivityCompletions', { courseActivityId: activityId, studentId: userId, status });
    }
  },
});
