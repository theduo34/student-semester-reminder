import { query } from './_generated/server';

// Published by the Academic Admin app. This app only ever reads from this table.
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();
  },
});
