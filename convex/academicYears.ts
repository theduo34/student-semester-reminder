import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query, QueryCtx } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { requireAdmin } from './adminAuth';
import { CourseActivityWithStatus, resolveCourseActivitiesForStudent } from './courseActivities';

export type SemesterBreakdown = {
  semester: Doc<'semesters'>;
  semesterActivities: Doc<'semesterActivities'>[];
  personalReminders: Doc<'personalReminders'>[];
  courseActivities: CourseActivityWithStatus[];
};

// One semester's worth of activities, scoped to the calling student — shared by
// getSemesterOverview below (currently its only caller, kept as its own function since
// the per-semester gathering logic is a distinct unit from resolving which semester to
// use, and admin activity-import work is expected to need the same shape later).
async function buildSemesterBreakdown(
  ctx: QueryCtx,
  userId: Doc<'users'>['_id'],
  semester: Doc<'semesters'>,
): Promise<SemesterBreakdown> {
  const semesterActivities = await ctx.db
    .query('semesterActivities')
    .withIndex('by_semesterId', (q) => q.eq('semesterId', semester._id))
    .collect();

  const personalReminders = await ctx.db
    .query('personalReminders')
    .withIndex('by_userId_and_semesterId', (q) => q.eq('userId', userId).eq('semesterId', semester._id))
    .collect();

  const profile = await ctx.db
    .query('studentProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();

  let courseActivities: CourseActivityWithStatus[] = [];
  if (profile !== null) {
    const courses = await ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) =>
        q.eq('semesterId', semester._id).eq('academicClassId', profile.academicClassId),
      )
      .collect();
    courseActivities = await resolveCourseActivitiesForStudent(
      ctx,
      userId,
      new Set(courses.map((course) => course._id)),
    );
  }

  return { semester, semesterActivities, personalReminders, courseActivities };
}

// The Academic Year Progress screen's three-dot "view a different period" picker —
// every academic year with its semesters, open to any signed-in caller (same posture
// as semesters.ts#list, which this mirrors) since it's published, non-sensitive data a
// student needs to browse past/other periods, not just the currently active one.
export const listAllForSelection = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const years = await ctx.db.query('academicYears').collect();
    years.sort((a, b) => b.startDate - a.startDate);

    return Promise.all(
      years.map(async (year) => {
        const semesters = await ctx.db
          .query('semesters')
          .withIndex('by_academicYearId', (q) => q.eq('academicYearId', year._id))
          .collect();
        semesters.sort((a, b) => a.startDate - b.startDate);
        return {
          _id: year._id,
          title: year.title,
          semesters: semesters.map((semester) => ({
            _id: semester._id,
            title: semester.title,
            isActive: semester.isActive,
          })),
        };
      }),
    );
  },
});

// Backs the Academic Year Progress screen (see AGENTS.md's Academic year section) —
// the screen shows exactly one semester's progress at a time, this explicit semester
// or (by default, resolved client-side via semesters.ts#getActive) the currently
// active one, never both semesters of the academic year at once. Ownership/scoping is
// the same as every other per-student query in this app: everything beyond the
// requested semesterId is derived from ctx.auth (see AGENTS.md's Security section).
export const getSemesterOverview = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }): Promise<{ year: Doc<'academicYears'>; semester: SemesterBreakdown } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const semester = await ctx.db.get(semesterId);
    if (semester === null || semester.academicYearId === undefined) {
      return null;
    }

    const year = await ctx.db.get(semester.academicYearId);
    if (year === null) {
      return null;
    }

    return { year, semester: await buildSemesterBreakdown(ctx, userId, semester) };
  },
});

// --- Admin writes -------------------------------------------------------------------
// requireAdmin-gated, same posture as academicStructure.ts's admin CRUD — the
// Semesters page's "New academic year" flow. Nothing here is reachable from the
// mobile app's own screens.

// Every academic year, most recent first — mirrors semesters.ts#list's shape, powers
// the admin Semesters page's grouping.
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const years = await ctx.db.query('academicYears').collect();
    return years.sort((a, b) => b.startDate - a.startDate);
  },
});

export const createAcademicYear = mutation({
  args: { title: v.string(), startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.insert('academicYears', args);
  },
});

export const updateAcademicYear = mutation({
  args: { academicYearId: v.id('academicYears'), title: v.string(), startDate: v.number(), endDate: v.number() },
  handler: async (ctx, { academicYearId, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(academicYearId, patch);
  },
});

export const removeAcademicYear = mutation({
  args: { academicYearId: v.id('academicYears') },
  handler: async (ctx, { academicYearId }) => {
    await requireAdmin(ctx);
    // Blocked, not cascaded — same "safe default" posture as
    // academicStructure.ts's academicClassHasDependents guard. A year with semesters
    // still on it has real published data hanging off those semesters; deleting the
    // year out from under them would orphan the grouping, not the data itself, which
    // is confusing rather than helpful.
    const hasSemesters = await ctx.db
      .query('semesters')
      .withIndex('by_academicYearId', (q) => q.eq('academicYearId', academicYearId))
      .first();
    if (hasSemesters !== null) {
      throw new Error('This academic year still has semesters — remove those first.');
    }
    await ctx.db.delete(academicYearId);
  },
});
