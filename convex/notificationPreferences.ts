import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Device-level toggles for the Settings screen's Notifications/Calendar groups — one
// row per student. Distinct from reminderPreferences (per-priority timing intervals).
const DEFAULTS = { pushEnabled: true, soundEnabled: true, calendarSyncEnabled: false };

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return DEFAULTS;
    }
    const row = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_studentId', (q) => q.eq('studentId', userId))
      .unique();
    if (row === null) {
      return DEFAULTS;
    }
    return {
      pushEnabled: row.pushEnabled,
      soundEnabled: row.soundEnabled,
      calendarSyncEnabled: row.calendarSyncEnabled,
    };
  },
});

// Partial patch so each Switch can write just its own field without clobbering the
// others — the optimistic update on the client merges this shape directly into the
// cached getPreferences result.
export const setPreferences = mutation({
  args: {
    pushEnabled: v.optional(v.boolean()),
    soundEnabled: v.optional(v.boolean()),
    calendarSyncEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, patch) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const existing = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_studentId', (q) => q.eq('studentId', userId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert('notificationPreferences', { studentId: userId, ...DEFAULTS, ...patch });
    }
  },
});
