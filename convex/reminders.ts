import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { priorityValidator } from './schema';

// Reminders are scheduled entirely on-device via expo-notifications; this table just
// records what was scheduled so it can be looked up, cancelled, or rescheduled.

// Shipped defaults, minutes before due, used whenever a student has never saved a
// preference for that priority. Must line up with lib/reminderIntervals.ts's
// INTERVAL_OPTIONS minute values — client-side summary formatting looks up labels by
// exact minute match.
const DEFAULT_INTERVALS_MINUTES: Record<'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE', number[]> = {
  CRITICAL: [10080, 1440, 60],
  IMPORTANT: [1440, 60],
  FLEXIBLE: [60],
};

export const getPreferences = query({
  args: { priority: priorityValidator },
  handler: async (ctx, { priority }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return DEFAULT_INTERVALS_MINUTES[priority];
    }
    const row = await ctx.db
      .query('reminderPreferences')
      .withIndex('by_studentId_and_priority', (q) =>
        q.eq('studentId', userId).eq('priority', priority),
      )
      .unique();
    return row?.intervals ?? DEFAULT_INTERVALS_MINUTES[priority];
  },
});

export const setPreferences = mutation({
  args: { priority: priorityValidator, intervals: v.array(v.number()) },
  handler: async (ctx, { priority, intervals }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const existing = await ctx.db
      .query('reminderPreferences')
      .withIndex('by_studentId_and_priority', (q) =>
        q.eq('studentId', userId).eq('priority', priority),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { intervals });
    } else {
      await ctx.db.insert('reminderPreferences', { studentId: userId, priority, intervals });
    }
  },
});

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
      v.literal('personalReminders'),
    ),
    scheduledFor: v.number(),
    notificationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('reminders', args);
  },
});
