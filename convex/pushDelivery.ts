import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { ActionCtx, internalAction } from './_generated/server';
import { entityType } from './schema';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Mirrors the app's CRITICAL/IMPORTANT/FLEXIBLE priority tiers (see AGENTS.md's
// priority model), not an activity-type grouping — this is the one channel
// vocabulary push and any future local-notification scheduling (see
// hooks/use-notification-observer.ts, still a stub) should both register against, so
// they end up respecting the same Android importance/sound rules rather than inventing
// a second taxonomy.
const pushChannelValidator = v.optional(v.union(v.literal('critical'), v.literal('important'), v.literal('flexible')));

const pushDataValidator = v.object({ entityType, entityId: v.string() });

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

// Shared by sendPushToUser (the public-facing single-user send) and notifyNewEvent
// below (which fans this out to every student) — both need "look up this user's
// devices, POST to Expo, prune dead tokens," just for a different set of userIds.
async function deliverToUser(
  ctx: ActionCtx,
  userId: Id<'users'>,
  title: string,
  body: string,
  data: { entityType: Doc<'alerts'>['entityType']; entityId: string },
  channelId?: 'critical' | 'important' | 'flexible',
): Promise<{ sent: number; removed: number }> {
  const tokens = await ctx.runQuery(internal.pushTokens.listForUser, { userId });
  if (tokens.length === 0) {
    return { sent: 0, removed: 0 };
  }

  const messages = tokens.map((row) => ({
    to: row.token,
    title,
    body,
    data,
    channelId,
    sound: 'default' as const,
    priority: 'high' as const,
  }));

  let tickets: ExpoTicket[];
  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = (await response.json()) as { data: ExpoTicket[] };
    tickets = json.data;
  } catch (error) {
    // Expo's push service being unreachable shouldn't fail whatever triggered this send
    // (a new_event fan-out, an overdue cron pass) — the Alerts row this accompanies
    // already exists regardless of whether the push itself lands. Push is best-effort
    // on top of a record that's already durable.
    console.error('[pushDelivery] Expo push request failed', error);
    return { sent: 0, removed: 0 };
  }

  let removed = 0;
  await Promise.all(
    tickets.map(async (ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await ctx.runMutation(internal.pushTokens.removeToken, { userId, token: messages[index].to });
        removed += 1;
      } else if (ticket.status === 'error') {
        console.error('[pushDelivery] Expo ticket error', ticket.message);
      }
    }),
  );

  return { sent: tickets.filter((ticket) => ticket.status === 'ok').length, removed };
}

// The one entry point for sending real push to a single student — called directly for
// the overdue cron (convex/overdueSweep.ts) and indirectly (via notifyNewEvent's
// fan-out loop) for new institutional events. reminder_fired never calls this: it stays
// a purely local expo-notifications schedule (see AGENTS.md's Alerts feed section) — a
// local notification and a push for the same trigger would double-fire.
export const sendPushToUser = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    data: pushDataValidator,
    channelId: pushChannelValidator,
  },
  handler: async (ctx, { userId, title, body, data, channelId }) => {
    return deliverToUser(ctx, userId, title, body, data, channelId);
  },
});

// Fans a newly-published semesterActivity out to every student — see
// studentProfiles.listAllUserIds for the single-institution scoping caveat. Scheduled
// (never called directly) via ctx.scheduler.runAfter from wherever a semesterActivity
// is actually inserted — today that's only convex/seed.ts's upsertSemesterActivity,
// until the separate Admin app exists (see AGENTS.md's scope boundary). Writes the
// Alerts row itself (via alerts.createForUser) rather than leaving that to
// hooks/useAlertsSync.ts alone — that client-side path stays as a fallback in case this
// action's push leg fails or a student's device was offline when it ran, but the dedup
// on (userId, entityId, kind) means whichever path runs first is the one that counts.
export const notifyNewEvent = internalAction({
  args: {
    semesterActivityId: v.id('semesterActivities'),
    title: v.string(),
  },
  handler: async (ctx, { semesterActivityId, title }) => {
    const userIds = await ctx.runQuery(internal.studentProfiles.listAllUserIds, {});
    const alertTitle = 'New institutional event published';
    const data = { entityType: 'semesterActivities' as const, entityId: semesterActivityId };

    await Promise.all(
      userIds.map(async (userId) => {
        await ctx.runMutation(internal.alerts.createForUser, {
          userId,
          entityType: 'semesterActivities',
          entityId: semesterActivityId,
          kind: 'NEW_EVENT',
          title: alertTitle,
          subtitle: title,
        });
        await deliverToUser(ctx, userId, alertTitle, title, data, 'critical');
      }),
    );
  },
});

export { deliverToUser };
