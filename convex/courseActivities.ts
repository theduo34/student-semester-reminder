import { getAuthUserId } from '@convex-dev/auth/server';
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
    return ctx.db.insert('courseActivities', args);
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
