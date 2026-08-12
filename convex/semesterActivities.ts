import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { mutation, MutationCtx, query, QueryCtx } from './_generated/server';
import { requireAdmin } from './adminAuth';

const activityFields = {
  title: v.string(),
  description: v.optional(v.string()),
  date: v.number(),
};

// Resolves the category's own semesterId server-side rather than trusting a
// client-passed one — a category is already tied to exactly one semester
// (activityCategories.semesterId), so there's nothing for the client to get wrong
// here that this doesn't already pin down.
async function requireCategorySemesterId(
  ctx: QueryCtx | MutationCtx,
  categoryId: Id<'activityCategories'>,
): Promise<Id<'semesters'>> {
  const category = await ctx.db.get(categoryId);
  if (category === null) {
    throw new Error('Category not found');
  }
  return category.semesterId;
}

// The manual "Add activity" path — one admin-authored event, published in the moment,
// so it pushes to every student in real time (see pushDelivery.ts#notifyNewEvent).
export const createSemesterActivity = mutation({
  args: { categoryId: v.id('activityCategories'), ...activityFields },
  handler: async (ctx, { categoryId, title, description, date }) => {
    await requireAdmin(ctx);
    const semesterId = await requireCategorySemesterId(ctx, categoryId);
    const semesterActivityId = await ctx.db.insert('semesterActivities', {
      semesterId,
      categoryId,
      title,
      description,
      date,
    });
    await ctx.scheduler.runAfter(0, internal.pushDelivery.notifyNewEvent, {
      semesterActivityId,
      title,
    });
    return semesterActivityId;
  },
});

// The document-import path (see documentImport.ts) — anywhere from a handful to
// several dozen rows from one document, most of them not "new" in any real-time sense
// (a semester's worth of dates published at once). Deliberately does NOT push per row —
// fanning notifyNewEvent out across every row would mean every student's phone buzzing
// dozens of times in a few seconds for events spread across the whole semester, not
// something happening today. Students still see every row via the normal client-side
// NEW_EVENT alert sync (see AGENTS.md's Alerts feed section) — just without an OS
// notification burst attached.
export const createSemesterActivitiesBulk = mutation({
  args: {
    categoryId: v.id('activityCategories'),
    activities: v.array(v.object(activityFields)),
  },
  handler: async (ctx, { categoryId, activities }) => {
    await requireAdmin(ctx);
    const semesterId = await requireCategorySemesterId(ctx, categoryId);
    return await Promise.all(
      activities.map((activity) => ctx.db.insert('semesterActivities', { semesterId, categoryId, ...activity })),
    );
  },
});

// The semester detail page's week-by-week overview — every category's activities in
// one semester, real cursor pagination (see the admin app's hooks/use-cursor-page.ts
// for why a hand-rolled cursor stack, not Convex's own usePaginatedQuery). Week
// grouping happens client-side, per fetched page, not globally — same trade-off the
// admin app's other paginated+grouped views already accept (a week can visually
// repeat its header across a page boundary; the underlying dates are unaffected).
export const listBySemesterPaginated = query({
  args: { semesterId: v.id('semesters'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { semesterId, paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('semesterActivities')
      .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
      .order('asc')
      .paginate(paginationOpts);
  },
});

// One admin-created category's own paginated activity list — the Publish page's
// category detail view. Rows created before the category system existed have no
// categoryId (see that field's own schema.ts comment) and simply don't appear here;
// they're still visible on the semester-wide view above.
export const listActivitiesByCategoryPaginated = query({
  args: { categoryId: v.id('activityCategories'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { categoryId, paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('semesterActivities')
      .withIndex('by_categoryId', (q) => q.eq('categoryId', categoryId))
      .order('asc')
      .paginate(paginationOpts);
  },
});

// The Publish page's Uncategorized view — real cursor pagination via the compound
// (semesterId, categoryId) index, matching rows where categoryId was never set
// (Convex indexes accept `undefined` as a real key component) rather than a
// full-table scan filtered in memory.
export const listUncategorizedBySemesterPaginated = query({
  args: { semesterId: v.id('semesters'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { semesterId, paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('semesterActivities')
      .withIndex('by_semesterId_and_categoryId', (q) => q.eq('semesterId', semesterId).eq('categoryId', undefined))
      .order('asc')
      .paginate(paginationOpts);
  },
});

// Cheap existence check for whether the Publish page's Uncategorized tile should
// show at all — a single indexed read, not a count (counting would mean fetching
// everything just to size a badge).
export const hasUncategorized = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query('semesterActivities')
      .withIndex('by_semesterId_and_categoryId', (q) => q.eq('semesterId', semesterId).eq('categoryId', undefined))
      .first();
    return row !== null;
  },
});

// Publish page's per-card Edit — a plain in-place patch, no push (editing an
// already-published event isn't a new one worth re-notifying every student about).
// categoryId is optional here (unlike create) so a plain title/date/description fix
// doesn't also require re-picking the category — omit it to leave the row where it is.
export const updateSemesterActivity = mutation({
  args: { semesterActivityId: v.id('semesterActivities'), categoryId: v.optional(v.id('activityCategories')), ...activityFields },
  handler: async (ctx, { semesterActivityId, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(semesterActivityId, patch);
  },
});

export const removeSemesterActivity = mutation({
  args: { semesterActivityId: v.id('semesterActivities') },
  handler: async (ctx, { semesterActivityId }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(semesterActivityId);
  },
});
