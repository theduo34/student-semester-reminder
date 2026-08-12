import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAdmin } from './adminAuth';

// Resolves the one section that applies to the signed-in student: their division's
// section if they have one and it exists, otherwise the undivided section.
export const getForStudentCourse = query({
  args: { courseId: v.id('courses') },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    const sections = await ctx.db
      .query('courseSections')
      .withIndex('by_courseId', (q) => q.eq('courseId', courseId))
      .collect();

    const divisionSection = profile?.divisionId
      ? sections.find((section) => section.divisionId === profile.divisionId)
      : undefined;
    const undividedSection = sections.find((section) => section.divisionId === undefined);

    return divisionSection ?? undividedSection ?? null;
  },
});

// Every one of the signed-in student's courses for a semester, each resolved to its
// one applicable section (same division-preferred/undivided-fallback rule as
// getForStudentCourse above, just batched into one round trip instead of one query per
// course) — the Calendar tab's recurring-class-times section reads this once rather
// than firing a query per course, which a courses.map(course => useQuery(...)) call
// site can't do anyway (conditional/variable-count hook calls aren't allowed). Rows
// with no resolved section (a course published with no timetable import yet) are
// left out entirely, not returned with empty schedule fields.
export const listMyScheduleForSemester = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
    if (profile === null) {
      return [];
    }

    const courses = await ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) =>
        q.eq('semesterId', semesterId).eq('academicClassId', profile.academicClassId),
      )
      .collect();

    const schedule = await Promise.all(
      courses.map(async (course) => {
        const sections = await ctx.db
          .query('courseSections')
          .withIndex('by_courseId', (q) => q.eq('courseId', course._id))
          .collect();
        const divisionSection = profile.divisionId
          ? sections.find((section) => section.divisionId === profile.divisionId)
          : undefined;
        const undividedSection = sections.find((section) => section.divisionId === undefined);
        const section = divisionSection ?? undividedSection;
        if (section === undefined) {
          return null;
        }
        return {
          courseId: course._id,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          colourTag: course.colourTag,
          scheduleDays: section.scheduleDays,
          scheduleTime: section.scheduleTime,
          venue: section.venue,
          lecturer: section.lecturer,
        };
      }),
    );

    return schedule.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  },
});

// --- Admin writes -------------------------------------------------------------------
// requireAdmin-gated, same posture as courses.ts's admin section — the manual "Add
// course" path in the admin app's Courses page. The AI timetable import goes through
// courses.ts#importCourseTimetable instead, which writes courseSections rows directly
// (bulk, grouped/merged across days) rather than calling these one at a time.

const courseSectionFields = {
  courseId: v.id('courses'),
  divisionId: v.optional(v.id('divisions')),
  scheduleDays: v.array(v.string()),
  scheduleTime: v.string(),
  venue: v.optional(v.string()),
  lecturer: v.optional(v.string()),
};

export const createCourseSection = mutation({
  args: courseSectionFields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.insert('courseSections', args);
  },
});

export const updateCourseSection = mutation({
  args: { courseSectionId: v.id('courseSections'), ...courseSectionFields },
  handler: async (ctx, { courseSectionId, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(courseSectionId, patch);
  },
});

export const removeCourseSection = mutation({
  args: { courseSectionId: v.id('courseSections') },
  handler: async (ctx, { courseSectionId }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(courseSectionId);
  },
});
