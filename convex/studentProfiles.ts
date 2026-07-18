import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Its null result IS the "needs profile setup" onboarding gate — see
// hooks/use-auth-gate.ts. No separate synced boolean flag.
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
  },
});

export const createProfile = mutation({
  args: {
    facultyId: v.id('faculties'),
    departmentId: v.id('departments'),
    programId: v.id('programs'),
    academicClassId: v.id('academicClasses'),
    divisionId: v.optional(v.id('divisions')),
    institutionalEmail: v.string(),
    indexNumber: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }

    const existing = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
    if (existing !== null) {
      throw new Error('Profile already exists');
    }

    const institution = await ctx.db.query('institutions').first();
    if (institution === null) {
      throw new Error('No institution configured');
    }
    const expectedSuffix = `@${institution.emailDomain}`.toLowerCase();
    if (!args.institutionalEmail.toLowerCase().endsWith(expectedSuffix)) {
      throw new Error(`Please use your ${institution.emailDomain} email address`);
    }

    return await ctx.db.insert('studentProfiles', { userId, ...args });
  },
});
