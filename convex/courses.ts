import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireAdmin } from './adminAuth';

// Published by the Academic Admin app. This app only ever reads from this table.
// Scoped to the signed-in student's academicClass (resolved server-side from their
// studentProfile, not trusted from the client) rather than every course in the
// semester institution-wide.
export const listMyCourses = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const profile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
    if (profile === null) {
      return [];
    }
    return ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) =>
        q.eq('semesterId', semesterId).eq('academicClassId', profile.academicClassId),
      )
      .collect();
  },
});

// --- Admin writes -------------------------------------------------------------------
// Everything below is requireAdmin-gated (see adminAuth.ts — the shared guard every
// other admin mutation in this codebase uses). Nothing here is reachable from the
// mobile app; the admin web app (termio-admin) is the only caller.

// Small fixed palette, deterministically hashed from courseCode — same idea as the
// mobile app's Avatar colour-hash (lib/initials.ts), reimplemented here rather than
// shared since this repo has no import boundary with the mobile app's client code.
const COURSE_COLOUR_PALETTE = [
  '#6366F1', // indigo
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
];

function colourForCourseCode(courseCode: string): string {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = (hash * 31 + courseCode.charCodeAt(i)) | 0;
  }
  return COURSE_COLOUR_PALETTE[Math.abs(hash) % COURSE_COLOUR_PALETTE.length];
}

// The admin Courses page's list view — unlike listMyCourses above, this is
// intentionally unscoped by any one student's academicClass, since an admin needs to
// see every course in the semester across every class to manage them.
export const listCoursesBySemester = query({
  args: { semesterId: v.id('semesters') },
  handler: async (ctx, { semesterId }) => {
    await requireAdmin(ctx);
    return ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) => q.eq('semesterId', semesterId))
      .collect();
  },
});

export const createCourse = mutation({
  args: {
    semesterId: v.id('semesters'),
    academicClassId: v.id('academicClasses'),
    courseCode: v.string(),
    courseTitle: v.string(),
  },
  handler: async (ctx, { semesterId, academicClassId, courseCode, courseTitle }) => {
    await requireAdmin(ctx);
    return ctx.db.insert('courses', {
      semesterId,
      academicClassId,
      courseCode,
      courseTitle,
      colourTag: colourForCourseCode(courseCode),
    });
  },
});

export const updateCourse = mutation({
  args: { courseId: v.id('courses'), courseCode: v.string(), courseTitle: v.string() },
  handler: async (ctx, { courseId, courseCode, courseTitle }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(courseId, { courseCode, courseTitle });
  },
});

export const removeCourse = mutation({
  args: { courseId: v.id('courses') },
  handler: async (ctx, { courseId }) => {
    await requireAdmin(ctx);
    // Blocked, not cascaded, when a courseActivity still references this course —
    // same "safe default over guided reassignment" posture academicStructure.ts's
    // academicClass delete guard uses, since a courseActivity has its own independent
    // completion history (courseActivityCompletions) that silently orphaning would lose
    // track of.
    const hasActivities = await ctx.db
      .query('courseActivities')
      .withIndex('by_courseId', (q) => q.eq('courseId', courseId))
      .first();
    if (hasActivities !== null) {
      throw new Error('This course still has activities — remove those first.');
    }
    // courseSections, by contrast, has no independent identity beyond describing this
    // course's own schedule — cascading its delete here is the expected behavior, not
    // an orphan risk.
    const sections = await ctx.db
      .query('courseSections')
      .withIndex('by_courseId', (q) => q.eq('courseId', courseId))
      .collect();
    await Promise.all(sections.map((section) => ctx.db.delete(section._id)));
    await ctx.db.delete(courseId);
  },
});

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function sortDays(days: Iterable<string>): string[] {
  return Array.from(days).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function sameDays(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((day, index) => day === b[index]);
}

const timetableRowFields = {
  courseCode: v.string(),
  courseTitle: v.string(),
  lecturer: v.optional(v.string()),
  day: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  venue: v.optional(v.string()),
};

// The write side of the AI timetable import (see documentImport.ts#parseCourseTimetable
// for the read/extraction side — that action never writes to the database itself, this
// is the only place timetable rows actually get published). Called once per class
// section the admin has mapped to a real academicClass in the review dialog — see
// import-timetable-dialog.tsx in the admin app.
//
// Idempotent by design, same "natural-key lookup before insert" rule seed.ts follows:
// re-running an import after fixing a mapping mistake updates matching courses/
// courseSections in place rather than piling up duplicates.
export const importCourseTimetable = mutation({
  args: {
    semesterId: v.id('semesters'),
    academicClassId: v.id('academicClasses'),
    divisionId: v.optional(v.id('divisions')),
    rows: v.array(v.object(timetableRowFields)),
  },
  handler: async (ctx, { semesterId, academicClassId, divisionId, rows }) => {
    await requireAdmin(ctx);

    const existingCourses = await ctx.db
      .query('courses')
      .withIndex('by_semesterId_and_academicClassId', (q) =>
        q.eq('semesterId', semesterId).eq('academicClassId', academicClassId),
      )
      .collect();
    const courseIdByCode = new Map<string, Id<'courses'>>(
      existingCourses.map((course) => [course.courseCode, course._id]),
    );

    // One courses row per distinct courseCode — keep the first-seen title for that
    // code, since every row for the same code should already share one.
    const byCourseCode = new Map<string, { courseTitle: string; rows: (typeof rows)[number][] }>();
    for (const row of rows) {
      const bucket = byCourseCode.get(row.courseCode);
      if (bucket) {
        bucket.rows.push(row);
      } else {
        byCourseCode.set(row.courseCode, { courseTitle: row.courseTitle, rows: [row] });
      }
    }

    let coursesCreated = 0;
    let sectionsWritten = 0;

    for (const [courseCode, { courseTitle, rows: courseRows }] of byCourseCode) {
      let courseId = courseIdByCode.get(courseCode);
      if (courseId === undefined) {
        courseId = await ctx.db.insert('courses', {
          semesterId,
          academicClassId,
          courseCode,
          courseTitle,
          colourTag: colourForCourseCode(courseCode),
        });
        courseIdByCode.set(courseCode, courseId);
        coursesCreated++;
      }

      // Group this course's rows by (startTime, endTime, venue, lecturer) — the same
      // slot repeated across multiple days (e.g. an identical Saturday+Sunday weekend
      // repeat) becomes ONE courseSections row with a combined scheduleDays array,
      // matching the schema's own array shape, rather than one row per day.
      const bySlot = new Map<
        string,
        { startTime: string; endTime: string; venue?: string; lecturer?: string; days: Set<string> }
      >();
      for (const row of courseRows) {
        const key = `${row.startTime}|${row.endTime}|${row.venue ?? ''}|${row.lecturer ?? ''}`;
        const slot = bySlot.get(key);
        if (slot) {
          slot.days.add(row.day);
        } else {
          bySlot.set(key, {
            startTime: row.startTime,
            endTime: row.endTime,
            venue: row.venue,
            lecturer: row.lecturer,
            days: new Set([row.day]),
          });
        }
      }

      const existingSections = await ctx.db
        .query('courseSections')
        .withIndex('by_courseId', (q) => q.eq('courseId', courseId))
        .collect();

      for (const slot of bySlot.values()) {
        const scheduleDays = sortDays(slot.days);
        const scheduleTime = `${slot.startTime}-${slot.endTime}`;
        const matching = existingSections.find(
          (section) =>
            section.divisionId === divisionId &&
            section.scheduleTime === scheduleTime &&
            section.venue === slot.venue &&
            sameDays(section.scheduleDays, scheduleDays),
        );
        if (matching) {
          await ctx.db.patch(matching._id, { lecturer: slot.lecturer });
        } else {
          await ctx.db.insert('courseSections', {
            courseId,
            divisionId,
            scheduleDays,
            scheduleTime,
            venue: slot.venue,
            lecturer: slot.lecturer,
          });
          sectionsWritten++;
        }
      }
    }

    return {
      coursesCreated,
      coursesMatched: byCourseCode.size - coursesCreated,
      sectionsWritten,
    };
  },
});
