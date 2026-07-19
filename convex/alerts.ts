import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { MutationCtx, mutation, query } from './_generated/server';
import { alertKindValidator, entityType, priorityValidator } from './schema';

// Admin-originated "new institutional event" alerts can't be pushed server-side in the
// MVP — that would need real Expo push infrastructure, out of scope for now (see
// AGENTS.md's Alerts feed section). `listBySemester` below (unrelated to the alerts
// table — reads semesterActivities directly) is what Calendar/Home use to merge
// institutional events into their own displays; it predates and is independent of the
// alerts feed built here.
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
    const existing = await ctx.db
      .query('alerts')
      .withIndex('by_userId_entityId_kind', (q) =>
        q.eq('userId', userId).eq('entityId', args.entityId).eq('kind', args.kind),
      )
      .unique();
    if (existing !== null) {
      return existing._id;
    }
    return ctx.db.insert('alerts', { userId, ...args, createdAt: Date.now(), isRead: false });
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
