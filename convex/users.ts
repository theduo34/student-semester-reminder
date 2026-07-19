import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

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
