import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { MutationCtx, mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { priorityValidator } from './schema';

// Owned by this app — the student's own reminders, never admin-managed. Every
// query/mutation here derives the caller from getAuthUserId(ctx); none accept a userId
// param. Client-side "you can only see your own" is UX, not security — ownership is
// enforced here, server-side, on every read and write. See CLAUDE.md's security rule.

async function requireOwnedReminder(
  ctx: MutationCtx,
  userId: Id<'users'>,
  reminderId: Id<'personalReminders'>,
) {
  const reminder = await ctx.db.get(reminderId);
  if (reminder === null || reminder.userId !== userId) {
    throw new Error('Reminder not found');
  }
  return reminder;
}

// courseId is optional (a standalone reminder), but when present it must resolve to a
// course in the caller's own academicClass — never trust that a client-side dropdown
// was actually populated from the right catalogue.
async function validateCourseOwnership(ctx: MutationCtx, userId: Id<'users'>, courseId: Id<'courses'>) {
  const course = await ctx.db.get(courseId);
  const profile = await ctx.db
    .query('studentProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();
  if (course === null || profile === null || course.academicClassId !== profile.academicClassId) {
    throw new Error('That course is not in your class');
  }
}

export const listMine = query({
  args: { semesterId: v.optional(v.id('semesters')) },
  handler: async (ctx, { semesterId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return ctx.db
      .query('personalReminders')
      .withIndex('by_userId_and_semesterId', (q) =>
        semesterId === undefined
          ? q.eq('userId', userId)
          : q.eq('userId', userId).eq('semesterId', semesterId),
      )
      .collect();
  },
});

// Single-reminder fetch for the Edit modal's prefill — ownership-checked like every
// other function here, so a stale/guessed id from a deep link can't leak another
// student's reminder.
export const getMine = query({
  args: { reminderId: v.id('personalReminders') },
  handler: async (ctx, { reminderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const reminder = await ctx.db.get(reminderId);
    if (reminder === null || reminder.userId !== userId) {
      return null;
    }
    return reminder;
  },
});

export const create = mutation({
  args: {
    semesterId: v.id('semesters'),
    title: v.string(),
    description: v.optional(v.string()),
    courseId: v.optional(v.id('courses')),
    dueDate: v.number(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    if (args.endTime !== undefined && args.endTime <= args.startTime) {
      throw new Error('End time must be after start time');
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (args.dueDate < startOfToday.getTime()) {
      throw new Error('Due date must be today or later');
    }
    if (args.courseId !== undefined) {
      await validateCourseOwnership(ctx, userId, args.courseId);
    }
    return await ctx.db.insert('personalReminders', { ...args, userId, isCompleted: false });
  },
});

export const update = mutation({
  args: {
    reminderId: v.id('personalReminders'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    // null clears the course (back to standalone); omitted leaves it unchanged; an Id
    // sets/changes it. Unlike admin-published course activities, courseId is editable
    // here — these are the student's own reminders.
    courseId: v.optional(v.union(v.id('courses'), v.null())),
    dueDate: v.optional(v.number()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.union(v.number(), v.null())),
    priority: v.optional(priorityValidator),
  },
  handler: async (ctx, { reminderId, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const existing = await requireOwnedReminder(ctx, userId, reminderId);

    const nextStartTime = patch.startTime ?? existing.startTime;
    const nextEndTime = 'endTime' in patch ? (patch.endTime ?? undefined) : existing.endTime;
    if (nextEndTime !== undefined && nextEndTime <= nextStartTime) {
      throw new Error('End time must be after start time');
    }
    // No due-date floor here (unlike create) — editing lets a past reminder be corrected.

    if (patch.courseId !== undefined && patch.courseId !== null) {
      await validateCourseOwnership(ctx, userId, patch.courseId);
    }

    await ctx.db.patch(reminderId, {
      ...patch,
      courseId: patch.courseId === null ? undefined : patch.courseId,
      endTime: patch.endTime === null ? undefined : patch.endTime,
    });
  },
});

export const remove = mutation({
  args: { reminderId: v.id('personalReminders') },
  handler: async (ctx, { reminderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    await requireOwnedReminder(ctx, userId, reminderId);
    await ctx.db.delete(reminderId);
  },
});

export const toggleComplete = mutation({
  args: { reminderId: v.id('personalReminders') },
  handler: async (ctx, { reminderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const existing = await requireOwnedReminder(ctx, userId, reminderId);
    await ctx.db.patch(reminderId, { isCompleted: !existing.isCompleted });
  },
});
