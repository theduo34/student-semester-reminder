import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { deliverToUser } from './pushDelivery';

// Runs every 15 minutes (see convex/crons.ts) — server-side overdue detection that
// works even when the app isn't open, unlike hooks/useAlertsSync.ts's client-side
// check, which only ever runs while a student has the app foregrounded. That client
// path is NOT removed by this — it stays as a fallback so the Alerts feed still fills
// in between cron runs (or if this cron is ever paused), and the two can never double-
// alert: both go through alerts.createForUser's dedup on (userId, entityId, kind), so
// whichever one gets there first is the one that counts, and only that first write
// sends a push (createForUser reports `created: false` on the second).
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const overdueCourseActivities = await ctx.runQuery(internal.courseActivities.listOverduePending, { now });
    const overduePersonalReminders = await ctx.runQuery(internal.personalReminders.listOverduePending, { now });

    await Promise.all(
      overdueCourseActivities.map(async (activity) => {
        const { created } = await ctx.runMutation(internal.alerts.createForUser, {
          userId: activity.studentId,
          entityType: 'courseActivities',
          entityId: activity._id,
          kind: 'OVERDUE',
          title: `${activity.title} is overdue`,
          subtitle: activity.courseLabel,
          priority: activity.priority,
        });
        if (created) {
          await deliverToUser(
            ctx,
            activity.studentId,
            `${activity.title} is overdue`,
            activity.courseLabel,
            { entityType: 'courseActivities', entityId: activity._id },
            activity.priority.toLowerCase() as 'critical' | 'important' | 'flexible',
          );
        }
      }),
    );

    await Promise.all(
      overduePersonalReminders.map(async (reminder) => {
        const { created } = await ctx.runMutation(internal.alerts.createForUser, {
          userId: reminder.userId,
          entityType: 'personalReminders',
          entityId: reminder._id,
          kind: 'OVERDUE',
          title: `${reminder.title} is overdue`,
          subtitle: reminder.courseLabel,
          priority: reminder.priority,
        });
        if (created) {
          await deliverToUser(
            ctx,
            reminder.userId,
            `${reminder.title} is overdue`,
            reminder.courseLabel,
            { entityType: 'personalReminders', entityId: reminder._id },
            reminder.priority.toLowerCase() as 'critical' | 'important' | 'flexible',
          );
        }
      }),
    );
  },
});
