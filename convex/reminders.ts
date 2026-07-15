import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Reminders are scheduled entirely on-device via expo-notifications; this table just
// records what was scheduled so it can be looked up, cancelled, or rescheduled.

export const listForStudent = query({
  args: { studentId: v.id('users') },
  handler: async (ctx, { studentId }) => {
    return ctx.db
      .query('reminders')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect();
  },
});

export const record = mutation({
  args: {
    studentId: v.id('users'),
    entityId: v.string(),
    entityType: v.union(
      v.literal('courseActivities'),
      v.literal('semesterActivities'),
      v.literal('personalTasks'),
    ),
    scheduledFor: v.number(),
    notificationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('reminders', args);
  },
});
