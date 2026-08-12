import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAdmin } from './adminAuth';

// requireAdmin-gated, same posture as every other admin CRUD file. Nothing here is
// reachable from the mobile app's own screens. Small, bounded per-semester list (an
// admin creates a handful of categories, not hundreds) — a plain fetch-all, unlike
// listActivitiesByCategoryPaginated in semesterActivities.ts, which is the one that
// actually needs real pagination since an individual category's activities can grow.
export const listBySemester = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('activityCategories')
      .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
      .collect();
  },
});

export const getCategory = query({
  args: { categoryId: v.id('activityCategories') },
  handler: async (ctx, { categoryId }) => {
    await requireAdmin(ctx);
    return ctx.db.get(categoryId);
  },
});

// kind is required here (never optional client-side, even though the schema field
// itself is optional for pre-existing rows — see schema.ts's comment) and immutable
// after creation: updateCategory below deliberately doesn't accept it. Switching an
// 'exams' category to 'general' (or back) mid-use would leave its existing rows in
// the wrong table for whatever the detail page now expects to read.
export const createCategory = mutation({
  args: {
    semesterId: v.id('semesters'),
    name: v.string(),
    description: v.optional(v.string()),
    kind: v.union(v.literal('general'), v.literal('exams')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.insert('activityCategories', args);
  },
});

export const updateCategory = mutation({
  args: { categoryId: v.id('activityCategories'), name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, { categoryId, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(categoryId, patch);
  },
});

// Deletes the category AND everything published under it in one action — a
// deliberate cascade, not the "block until admin clears it first" pattern this
// codebase otherwise defaults to (academicStructure.ts's academicClassHasDependents,
// courses.ts#removeCourse's courseActivities guard, ...). The Publish page's own
// confirmation dialog is the safety check here instead (it says up front that this
// removes every activity too) — a category's contents don't have the kind of
// independent significance a course or academicClass's dependents do, so a single
// confirmed "delete this category" is meant to really mean all of it.
export const removeCategory = mutation({
  args: { categoryId: v.id('activityCategories') },
  handler: async (ctx, { categoryId }) => {
    await requireAdmin(ctx);

    const semesterActivities = await ctx.db
      .query('semesterActivities')
      .withIndex('by_categoryId', (q) => q.eq('categoryId', categoryId))
      .collect();
    await Promise.all(semesterActivities.map((activity) => ctx.db.delete(activity._id)));

    const courseActivities = await ctx.db
      .query('courseActivities')
      .withIndex('by_categoryId', (q) => q.eq('categoryId', categoryId))
      .collect();
    await Promise.all(
      courseActivities.map(async (activity) => {
        // Same completion-row cleanup courseActivities.ts#remove does for a single
        // activity — no cascade delete in Convex, and a completion row pointing at a
        // just-deleted activity would be a dead reference otherwise.
        const completions = await ctx.db
          .query('courseActivityCompletions')
          .withIndex('by_courseActivityId', (q) => q.eq('courseActivityId', activity._id))
          .collect();
        await Promise.all(completions.map((completion) => ctx.db.delete(completion._id)));
        await ctx.db.delete(activity._id);
      }),
    );

    await ctx.db.delete(categoryId);
  },
});
