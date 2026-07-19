import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { activityStatusValidator } from './schema';

// This app owns this table (assignments, quizzes, projects, exams).
// TODO: scope these to ctx.auth.getUserIdentity() once the auth flow is wired up —
// they take an explicit studentId for now so the schema/API shape can be reviewed first.

export const listForStudent = query({
  args: { studentId: v.id('users') },
  handler: async (ctx, { studentId }) => {
    return ctx.db
      .query('courseActivities')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    studentId: v.id('users'),
    courseId: v.id('courses'),
    title: v.string(),
    activityType: v.union(
      v.literal('ASSIGNMENT'),
      v.literal('QUIZ'),
      v.literal('PROJECT'),
      v.literal('EXAM'),
    ),
    dueDate: v.number(),
    priority: v.union(v.literal('CRITICAL'), v.literal('IMPORTANT'), v.literal('FLEXIBLE')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('courseActivities', { ...args, status: 'PENDING' });
  },
});

export const update = mutation({
  args: { id: v.id('courseActivities'), patch: v.any() },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id('courseActivities') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Unlike create/update/remove above, this one IS auth-checked — it's the one write a
// student actually makes against admin-owned data (the Activity Details screen's Mark
// complete button), so it follows the same ctx.auth-derived-ownership pattern as every
// other per-student mutation in this app rather than trusting a client-passed id (see
// AGENTS.md's Security section).
export const updateStatus = mutation({
  args: { activityId: v.id('courseActivities'), status: activityStatusValidator },
  handler: async (ctx, { activityId, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const activity = await ctx.db.get(activityId);
    if (activity === null || activity.studentId !== userId) {
      throw new Error('Activity not found');
    }
    await ctx.db.patch(activityId, { status });
  },
});
