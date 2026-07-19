import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { query } from './_generated/server';

// Single polymorphic resolver for the activity-details screen (app/(protected)/
// activity/[entityId]/index.tsx) — entityId can arrive from a notification payload, a
// deep link, or a stale list-item tap, so it's resolved against all three owning tables
// server-side rather than trusting a client-supplied `type` param, which is only ever a
// hint. ctx.db.normalizeId is the documented Convex mechanism for "this string might be
// an id from one of several tables" — it returns null instead of throwing when the
// string doesn't decode to that table, which is what makes checking three tables in
// sequence safe. Ownership is still checked per-kind, same as every other per-student
// query in this app (see AGENTS.md's Security section): a course activity or personal
// reminder that isn't the caller's own resolves to null, exactly like a genuinely
// missing id. Semester activities are institution-wide, so no ownership check applies.
export const resolveById = query({
  args: { entityId: v.string() },
  handler: async (ctx, { entityId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const courseActivityId = ctx.db.normalizeId('courseActivities', entityId);
    if (courseActivityId !== null) {
      const activity = await ctx.db.get(courseActivityId);
      if (activity !== null && activity.studentId === userId) {
        const course = await ctx.db.get(activity.courseId);
        return { kind: 'course' as const, activity, course };
      }
    }

    const semesterActivityId = ctx.db.normalizeId('semesterActivities', entityId);
    if (semesterActivityId !== null) {
      const activity = await ctx.db.get(semesterActivityId);
      if (activity !== null) {
        return { kind: 'semester' as const, activity, course: null };
      }
    }

    const personalReminderId = ctx.db.normalizeId('personalReminders', entityId);
    if (personalReminderId !== null) {
      const reminder = await ctx.db.get(personalReminderId);
      if (reminder !== null && reminder.userId === userId) {
        const course = reminder.courseId ? await ctx.db.get(reminder.courseId) : null;
        return { kind: 'personal' as const, activity: reminder, course };
      }
    }

    return null;
  },
});
