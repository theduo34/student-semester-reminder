import { getAuthUserId } from '@convex-dev/auth/server';
import { Infer, v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation, MutationCtx, mutation, query } from './_generated/server';
import { alertKindValidator, entityType, priorityValidator } from './schema';

type AlertContentArgs = {
  entityType: Infer<typeof entityType>;
  entityId: string;
  kind: Infer<typeof alertKindValidator>;
  title: string;
  subtitle: string;
  priority?: Infer<typeof priorityValidator>;
};

// Shared by `create` (public, auth-derived owner) and `createForUser` (internal,
// system-trusted owner — called from convex/pushDelivery.ts and convex/overdueSweep.ts,
// which act on behalf of a student without that student making the request). Same
// (userId, entityId, kind) dedup either way, so a server-triggered alert and the
// client's own useAlertsSync fallback never produce two rows for the same transition —
// whichever writes first wins, the other finds `created: false` and moves on.
async function upsertAlert(ctx: MutationCtx, userId: Id<'users'>, args: AlertContentArgs) {
  const existing = await ctx.db
    .query('alerts')
    .withIndex('by_userId_entityId_kind', (q) =>
      q.eq('userId', userId).eq('entityId', args.entityId).eq('kind', args.kind),
    )
    .unique();
  if (existing !== null) {
    return { alertId: existing._id, created: false };
  }
  const alertId = await ctx.db.insert('alerts', { userId, ...args, createdAt: Date.now(), isRead: false });
  return { alertId, created: true };
}

// `listBySemester` below is unrelated to the alerts table — it reads semesterActivities
// directly, and is what Calendar/Home use to merge institutional events into their own
// displays. It predates and is independent of the alerts feed built here. Real push
// delivery for new institutional events is handled elsewhere entirely — see
// convex/pushDelivery.ts's notifyNewEvent and CLAUDE.md's Push architecture section —
// not by this query.
export const listBySemester = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    return ctx.db
      .query('semesterActivities')
      .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
      .collect();
  },
});

// --- The Alerts tab's feed — a client-derived log written by hooks/useAlertsSync.ts,
// the one place all three creation points live (REMINDER_FIRED, NEW_EVENT, OVERDUE).
// Every function here derives the owner from getAuthUserId(ctx), same pattern as
// personalReminders.ts — see AGENTS.md's Security section. ---

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return ctx.db
      .query('alerts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

async function requireOwnedAlert(ctx: MutationCtx, userId: Id<'users'>, alertId: Id<'alerts'>) {
  const alert = await ctx.db.get(alertId);
  if (alert === null || alert.userId !== userId) {
    throw new Error('Alert not found');
  }
  return alert;
}

// Called by useAlertsSync for all three alert kinds. Idempotent by design — the
// (userId, entityId, kind) triple is checked before insert, so a redundant sync pass
// (clock drift re-flagging the same overdue item, a second foreground within the same
// minute) never produces a duplicate. Returns the existing alert's id if one already
// matches, rather than throwing — sync is a background loop, not a user action, so
// "already logged" isn't an error case.
export const create = mutation({
  args: {
    entityType,
    entityId: v.string(),
    kind: alertKindValidator,
    title: v.string(),
    subtitle: v.string(),
    priority: v.optional(priorityValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const { alertId } = await upsertAlert(ctx, userId, args);
    return alertId;
  },
});

// Internal counterpart to `create` — same dedup, but the owner is a trusted server-
// supplied userId instead of the caller's own identity. Used by convex/pushDelivery.ts
// (new_event fan-out) and convex/overdueSweep.ts (the overdue cron), both of which are
// logging an alert *for* a student the request isn't coming from. Never exposed to
// clients (internalMutation) — a client passing an arbitrary userId here would be
// exactly the kind of cross-user write AGENTS.md's Security section rules out.
// Returns `created` so callers only send a push on a genuinely new transition, not on
// every redundant cron pass or a pass that raced the client's own useAlertsSync.
export const createForUser = internalMutation({
  args: {
    userId: v.id('users'),
    entityType,
    entityId: v.string(),
    kind: alertKindValidator,
    title: v.string(),
    subtitle: v.string(),
    priority: v.optional(priorityValidator),
  },
  handler: async (ctx, { userId, ...args }) => {
    return upsertAlert(ctx, userId, args);
  },
});

export const markRead = mutation({
  args: { alertId: v.id('alerts') },
  handler: async (ctx, { alertId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const alert = await requireOwnedAlert(ctx, userId, alertId);
    if (!alert.isRead) {
      await ctx.db.patch(alertId, { isRead: true });
    }
  },
});

// Tapping a push notification (see hooks/use-notification-observer.ts) only carries
// entityType/entityId in its data payload, not the specific alert's _id — this looks
// the alert up the same way alerts.create's own dedup check does, via the
// by_userId_entityId_kind index, rather than requiring the client to already know an
// id it was never given. Silent no-op if no matching alert exists (e.g. the student
// had already deleted it) — same "not a user action, so missing isn't an error" stance
// as create's own idempotency.
export const markReadByEntity = mutation({
  args: { entityId: v.string(), kind: alertKindValidator },
  handler: async (ctx, { entityId, kind }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const alert = await ctx.db
      .query('alerts')
      .withIndex('by_userId_entityId_kind', (q) => q.eq('userId', userId).eq('entityId', entityId).eq('kind', kind))
      .unique();
    if (alert !== null && !alert.isRead) {
      await ctx.db.patch(alert._id, { isRead: true });
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const rows = await ctx.db
      .query('alerts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    await Promise.all(rows.filter((row) => !row.isRead).map((row) => ctx.db.patch(row._id, { isRead: true })));
  },
});

// Named `remove`/`removeAll`, not `delete`/`deleteAll` — `delete` is a reserved word,
// not a valid binding name (`export const delete = ...` is a syntax error); this
// matches personalReminders.ts's and courseActivities.ts's own `remove` naming for the
// exact same reason, not a one-off choice here.
export const remove = mutation({
  args: { alertId: v.id('alerts') },
  handler: async (ctx, { alertId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    await requireOwnedAlert(ctx, userId, alertId);
    await ctx.db.delete(alertId);
  },
});

export const removeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const rows = await ctx.db
      .query('alerts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  },
});
