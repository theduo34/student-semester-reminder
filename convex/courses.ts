import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { query } from './_generated/server';

// Published by the Academic Admin app. This app only ever reads from this table.
// Scoped to the signed-in student's academicClass (resolved server-side from their
// studentProfile, not trusted from the client) rather than every course in the
// semester institution-wide.
export const listMyCourses = query({
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
    return ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) =>
        q.eq('semesterId', semesterId).eq('academicClassId', profile.academicClassId),
      )
      .collect();
  },
});
