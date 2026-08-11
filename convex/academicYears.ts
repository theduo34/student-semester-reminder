import { getAuthUserId } from '@convex-dev/auth/server';

import { query } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { CourseActivityWithStatus, resolveCourseActivitiesForStudent } from './courseActivities';

export type SemesterBreakdown = {
  semester: Doc<'semesters'>;
  semesterActivities: Doc<'semesterActivities'>[];
  personalReminders: Doc<'personalReminders'>[];
  courseActivities: CourseActivityWithStatus[];
};

// Backs Home's Academic Year Progress card and its own detail screen (see AGENTS.md's
// Academic year section). An academic year is exactly two semesters (schema.ts's
// academicYears table); this resolves the year containing the CURRENTLY active
// semester and gathers every activity across both, per semester, scoped to the calling
// student — never a client-passed studentId, same rule as every other per-student
// query in this app (see AGENTS.md's Security section).
export const getCurrentYearOverview = query({
  args: {},
  handler: async (ctx): Promise<{ year: Doc<'academicYears'>; semesters: SemesterBreakdown[] } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const activeSemester = await ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();
    if (activeSemester === null || activeSemester.academicYearId === undefined) {
      // No active semester, or one predating the academicYears concept (see schema.ts's
      // comment on that field) — nothing to group, the card that would link here
      // already doesn't render without an active semester either way.
      return null;
    }

    const year = await ctx.db.get(activeSemester.academicYearId);
    if (year === null) {
      return null;
    }

    const yearSemesters = await ctx.db
      .query('semesters')
      .withIndex('by_academicYearId', (q) => q.eq('academicYearId', year._id))
      .collect();
    yearSemesters.sort((a, b) => a.startDate - b.startDate);

    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    const semesters: SemesterBreakdown[] = await Promise.all(
      yearSemesters.map(async (semester) => {
        const semesterActivities = await ctx.db
          .query('semesterActivities')
          .withIndex('by_semesterId', (q) => q.eq('semesterId', semester._id))
          .collect();

        const personalReminders = await ctx.db
          .query('personalReminders')
          .withIndex('by_userId_and_semesterId', (q) => q.eq('userId', userId).eq('semesterId', semester._id))
          .collect();

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
      }),
    );

    return { year, semesters };
  },
});
