import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internalQuery, mutation, query } from './_generated/server';

// System-only — shared by convex/seed.ts (the demo student) and convex/admins.ts (the
// admin account creation/reset dance), both of which need "does a user with this email
// already exist" before deciding whether to createAccount or reuse/reset the existing
// one. One lookup, not two copies of the same query.
export const findUserIdByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', email))
      .unique();
    return user?._id ?? null;
  },
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

// `name` lives on the auth `users` table (authTables), not studentProfiles — this is
// the one field the profile detail screen edits there instead of on studentProfiles.
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Name cannot be empty');
    }
    await ctx.db.patch(userId, { name: trimmed });
  },
});
