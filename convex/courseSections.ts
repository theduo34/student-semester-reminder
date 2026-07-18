import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { query } from './_generated/server';

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
