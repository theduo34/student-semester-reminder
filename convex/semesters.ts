import { v } from 'convex/values';

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

// Every semester ever published, most recent first — powers the admin Semester
// Overview screen's semester picker (app/(admin)/semester-overview/index.tsx), which
// needs to browse past semesters too, not just the active one. Open to any signed-in
// caller like getActive above — this is published, non-sensitive data, no
// requireAdmin gate needed (same posture as academicStructure.ts's read queries).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const semesters = await ctx.db.query('semesters').collect();
    return semesters.sort((a, b) => b.startDate - a.startDate);
  },
});

// Powers termio-admin's semester detail page (Dashboard's hero card and the
// Semesters list both link straight to a specific semester by id). Same open-to-
// any-signed-in-caller posture as list/getActive above.
export const get = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    return ctx.db.get(semesterId);
  },
});
