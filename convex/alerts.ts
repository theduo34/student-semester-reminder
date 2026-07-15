import { v } from 'convex/values';

import { query } from './_generated/server';

// Admin-originated alerts (e.g. "new institutional event published") can't be pushed
// server-side in the MVP — that would need real Expo push infrastructure, which is out
// of scope for now (see AGENTS.md "Alerts feed" section). Instead the client subscribes
// to this query, diffs it against what it already knows about in AsyncStorage, and logs
// anything new into a local read/unread feed.
export const listBySemester = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    return ctx.db
      .query('semesterActivities')
      .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
      .collect();
  },
});
