import { v } from 'convex/values';

import { query } from './_generated/server';

// Published by the Academic Admin app. This app only ever reads from this table.
export const listBySemester = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    return ctx.db
      .query('courses')
      .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
      .collect();
  },
});
