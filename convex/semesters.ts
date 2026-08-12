import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { requireAdmin } from './adminAuth';

// Published by the Academic Admin app. This app only ever reads from this table.
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();
  },
});

// Every semester ever published, most recent first — powers the admin Semester
// Overview screen's semester picker (app/(admin)/semester-overview/index.tsx), which
// needs to browse past semesters too, not just the active one. Open to any signed-in
// caller like getActive above — this is published, non-sensitive data, no
// requireAdmin gate needed (same posture as academicStructure.ts's read queries).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const semesters = await ctx.db.query('semesters').collect();
    return semesters.sort((a, b) => b.startDate - a.startDate);
  },
});

// Powers termio-admin's semester detail page (Dashboard's hero card and the
// Semesters list both link straight to a specific semester by id). Same open-to-
// any-signed-in-caller posture as list/getActive above.
export const get = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    return ctx.db.get(semesterId);
  },
});

// --- Admin writes -------------------------------------------------------------------
// requireAdmin-gated, same posture as academicStructure.ts's admin CRUD. Nothing here
// is reachable from the mobile app's own screens.

export const createSemester = mutation({
  args: {
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    academicYearId: v.id('academicYears'),
  },
  handler: async (ctx, { title, startDate, endDate, academicYearId }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const withinRange = startDate <= now && now <= endDate;
    const currentActive = await ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();
    // Good UX (don't make admin wait for the next hourly sync tick to see a
    // just-created current-dated semester show up as active) — but a manual pin on
    // the existing active semester still wins, same rule syncActiveSemester follows.
    const shouldActivate = withinRange && currentActive?.activeMode !== 'manual';
    if (shouldActivate && currentActive !== null) {
      await ctx.db.patch(currentActive._id, { isActive: false });
    }
    return ctx.db.insert('semesters', {
      title,
      startDate,
      endDate,
      academicYearId,
      isActive: shouldActivate,
      activeMode: 'auto',
    });
  },
});

export const updateSemester = mutation({
  args: { semesterId: v.id('semesters'), title: v.string(), startDate: v.number(), endDate: v.number() },
  handler: async (ctx, { semesterId, title, startDate, endDate }) => {
    await requireAdmin(ctx);
    // Deliberately doesn't touch isActive/activeMode — a date edit takes effect
    // through the next syncActiveSemester pass, not immediately, so this mutation
    // stays simple and predictable rather than re-running activation logic inline.
    await ctx.db.patch(semesterId, { title, startDate, endDate });
  },
});

export const removeSemester = mutation({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    await requireAdmin(ctx);
    const [hasCourses, hasActivities] = await Promise.all([
      ctx.db
        .query('courses')
        .withIndex('by_semesterId_and_academicClassId', (q) => q.eq('semesterId', semesterId))
        .first(),
      ctx.db
        .query('semesterActivities')
        .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
        .first(),
    ]);
    if (hasCourses !== null) {
      throw new Error('This semester still has courses — remove those first.');
    }
    if (hasActivities !== null) {
      throw new Error('This semester still has published activities — remove those first.');
    }
    // personalReminders has no standalone semesterId index (only the compound
    // by_userId_and_semesterId, see schema.ts) — a genuine full-table scan, same
    // "flagged not fixed at this app's demo scale" posture used throughout this
    // schema for admin-triggered checks like this one.
    const reminders = await ctx.db.query('personalReminders').collect();
    if (reminders.some((reminder) => reminder.semesterId === semesterId)) {
      throw new Error('Students still have personal reminders tied to this semester — remove those first.');
    }
    await ctx.db.delete(semesterId);
  },
});

// The manual-override entry point (Semesters page's "Set active" row action) — pins
// this semester active regardless of its own date range, and marks it 'manual' so
// syncActiveSemester below leaves it alone until admin picks a different one.
export const setActiveSemester = mutation({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(semesterId);
    if (target === null) {
      throw new Error('Semester not found');
    }
    const currentlyActive = await ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .collect();
    await Promise.all(
      currentlyActive
        .filter((semester) => semester._id !== semesterId)
        .map((semester) => ctx.db.patch(semester._id, { isActive: false })),
    );
    await ctx.db.patch(semesterId, { isActive: true, activeMode: 'manual' });
  },
});

// The hourly cron's sync logic (see crons.ts) — keeps "active" following real
// semester dates for any semester admin hasn't explicitly pinned. An explicit pin
// (activeMode: 'manual') is never silently reverted by the clock; admin has to pick a
// different semester (or a future "switch to automatic" action, not built this pass)
// to release it. Small table — a full scan here is fine, same posture as every other
// admin-scale scan in this schema.
export const syncActiveSemester = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentlyActive = await ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();

    if (currentlyActive !== null) {
      const stillWithinRange = currentlyActive.startDate <= now && now <= currentlyActive.endDate;
      if (currentlyActive.activeMode === 'manual' || stillWithinRange) {
        return;
      }
    }

    const allSemesters = await ctx.db.query('semesters').collect();
    const dueToActivate = allSemesters.find((semester) => semester.startDate <= now && now <= semester.endDate);
    if (dueToActivate === undefined || dueToActivate._id === currentlyActive?._id) {
      return;
    }

    if (currentlyActive !== null) {
      await ctx.db.patch(currentlyActive._id, { isActive: false });
    }
    await ctx.db.patch(dueToActivate._id, { isActive: true, activeMode: 'auto' });
  },
});
