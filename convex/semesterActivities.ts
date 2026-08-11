import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation } from './_generated/server';
import { requireAdmin } from './adminAuth';

const activityFields = {
  title: v.string(),
  description: v.optional(v.string()),
  date: v.number(),
};

// The manual "Add activity" path — one admin-authored event, published in the moment,
// so it pushes to every student in real time (see pushDelivery.ts#notifyNewEvent).
export const createSemesterActivity = mutation({
  args: { semesterId: v.id('semesters'), ...activityFields },
  handler: async (ctx, { semesterId, title, description, date }) => {
    await requireAdmin(ctx);
    const semesterActivityId = await ctx.db.insert('semesterActivities', { semesterId, title, description, date });
    await ctx.scheduler.runAfter(0, internal.pushDelivery.notifyNewEvent, {
      semesterActivityId,
      title,
    });
    return semesterActivityId;
  },
});

// The document-import path (see documentImport.ts) — anywhere from a handful to
// several dozen rows from one calendar, most of them not "new" in any real-time sense
// (a semester's worth of dates published at once). Deliberately does NOT push per row —
// fanning notifyNewEvent out across every row would mean every student's phone buzzing
// dozens of times in a few seconds for events spread across the whole semester, not
// something happening today. Students still see every row via the normal client-side
// NEW_EVENT alert sync (see AGENTS.md's Alerts feed section) — just without an OS
// notification burst attached.
export const createSemesterActivitiesBulk = mutation({
  args: {
    semesterId: v.id('semesters'),
    activities: v.array(v.object(activityFields)),
  },
  handler: async (ctx, { semesterId, activities }) => {
    await requireAdmin(ctx);
    return await Promise.all(
      activities.map((activity) => ctx.db.insert('semesterActivities', { semesterId, ...activity })),
    );
  },
});
