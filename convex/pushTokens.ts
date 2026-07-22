import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internalMutation, internalQuery, mutation } from './_generated/server';

const platformValidator = v.union(v.literal('ios'), v.literal('android'));

// One row per (student, device) — a student on two devices gets two rows, never one
// overwritten row. Upserted by the exact (userId, token) pair: the same physical token
// reappearing (app relaunch, the token-rotation listener firing with an unchanged
// value) just refreshes updatedAt instead of inserting a duplicate.
export const registerPushToken = mutation({
  args: { token: v.string(), platform: platformValidator },
  handler: async (ctx, { token, platform }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_userId_and_token', (q) => q.eq('userId', userId).eq('token', token))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now(), platform });
      return;
    }
    await ctx.db.insert('pushTokens', { userId, token, platform, updatedAt: Date.now() });
  },
});

// Called on logout, before the auth session clears (see lib/pushNotifications.ts) — so
// a signed-out student's push doesn't keep landing on a device a different account
// later logs into. Silent no-op if the token's already gone.
export const unregisterPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_userId_and_token', (q) => q.eq('userId', userId).eq('token', token))
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});

// System-only — read by convex/pushDelivery.ts's sendPushToUser action via
// ctx.runQuery, never exposed to clients. A client being able to ask "what are THIS
// other user's push tokens" is exactly what per-user ownership checks elsewhere in this
// app exist to prevent; internalQuery is what keeps this one un-callable from a client.
export const listForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query('pushTokens')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
  },
});

// Called by sendPushToUser when Expo's push receipt reports a token as
// DeviceNotRegistered — the app was uninstalled or the token otherwise died, so stop
// sending to it rather than retrying forever against a dead device.
export const removeToken = internalMutation({
  args: { userId: v.id('users'), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_userId_and_token', (q) => q.eq('userId', userId).eq('token', token))
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});
