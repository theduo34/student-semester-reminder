import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// This app owns this table, scoped per-student.
// TODO: scope these to ctx.auth.getUserIdentity() once the auth flow is wired up.

export const listForStudent = query({
  args: { studentId: v.id('users') },
  handler: async (ctx, { studentId }) => {
    return ctx.db
      .query('personalTasks')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    studentId: v.id('users'),
    title: v.string(),
    dueDate: v.optional(v.number()),
    priority: v.union(v.literal('CRITICAL'), v.literal('IMPORTANT'), v.literal('FLEXIBLE')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('personalTasks', { ...args, status: 'PENDING' });
  },
});

export const update = mutation({
  args: { id: v.id('personalTasks'), patch: v.any() },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id('personalTasks') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
