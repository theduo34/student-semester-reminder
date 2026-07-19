import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { MutationCtx, mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';

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

async function requireMyProfile(ctx: MutationCtx, userId: Id<'users'>) {
  const profile = await ctx.db
    .query('studentProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();
  if (profile === null) {
    throw new Error('Profile not found');
  }
  return profile;
}

async function requireInstitutionalEmailDomain(ctx: MutationCtx, institutionalEmail: string) {
  const institution = await ctx.db.query('institutions').first();
  if (institution === null) {
    throw new Error('No institution configured');
  }
  const expectedSuffix = `@${institution.emailDomain}`.toLowerCase();
  if (!institutionalEmail.toLowerCase().endsWith(expectedSuffix)) {
    throw new Error(`Please use your ${institution.emailDomain} email address`);
  }
}

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

    await requireInstitutionalEmailDomain(ctx, args.institutionalEmail);

    return await ctx.db.insert('studentProfiles', { userId, ...args });
  },
});

// Profile detail screen's ACCOUNT group — phone number only; name lives on the auth
// `users` table (see users.ts's updateName), and email there is the auth account email,
// deliberately not editable here (re-verification is out of scope, see AGENTS.md).
export const updatePhoneNumber = mutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const profile = await requireMyProfile(ctx, userId);
    const trimmed = phoneNumber.trim();
    if (trimmed.length === 0) {
      throw new Error('Phone number cannot be empty');
    }
    await ctx.db.patch(profile._id, { phoneNumber: trimmed });
  },
});

// Single-field edit, same emailDomain rule as createProfile — no cascading concern
// since institutionalEmail doesn't drive any other field.
export const updateInstitutionalEmail = mutation({
  args: { institutionalEmail: v.string() },
  handler: async (ctx, { institutionalEmail }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const profile = await requireMyProfile(ctx, userId);
    await requireInstitutionalEmailDomain(ctx, institutionalEmail);
    await ctx.db.patch(profile._id, { institutionalEmail });
  },
});

// Single-field edit — Division has nothing below it in the hierarchy, so no cascading
// clear-out is needed the way updateAcademicHierarchy needs one below.
export const updateDivision = mutation({
  args: { divisionId: v.id('divisions') },
  handler: async (ctx, { divisionId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const profile = await requireMyProfile(ctx, userId);
    const division = await ctx.db.get(divisionId);
    if (division === null || division.academicClassId !== profile.academicClassId) {
      throw new Error('Invalid division selection');
    }
    await ctx.db.patch(profile._id, { divisionId });
  },
});

// Cascading academic-hierarchy edit (Faculty/Department/Program/Level+Session/
// Division), reached from the profile detail screen's ACADEMIC group via the same
// HierarchyPicker cascade used on Profile Setup — see
// components/features/onboarding/AcademicHierarchyForm.tsx. Re-validates the whole
// chain server-side (createProfile trusts the client-resolved chain; this mutation is
// more consequential — it can move a student to a different academicClass entirely —
// so it re-derives and checks each link itself rather than trusting the client sent a
// self-consistent set of ids).
//
// Changing academicClassId can orphan personalReminders.courseId values that pointed at
// a course from the OLD class — those links are nulled out (never the reminder itself
// deleted) so the student's own reminders don't silently break; see AGENTS.md.
export const updateAcademicHierarchy = mutation({
  args: {
    facultyId: v.id('faculties'),
    departmentId: v.id('departments'),
    programId: v.id('programs'),
    academicClassId: v.id('academicClasses'),
    divisionId: v.optional(v.id('divisions')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const profile = await requireMyProfile(ctx, userId);

    const academicClass = await ctx.db.get(args.academicClassId);
    if (academicClass === null || academicClass.programId !== args.programId) {
      throw new Error('Invalid level/session selection');
    }
    const program = await ctx.db.get(args.programId);
    if (program === null || program.departmentId !== args.departmentId) {
      throw new Error('Invalid program selection');
    }
    const department = await ctx.db.get(args.departmentId);
    if (department === null || department.facultyId !== args.facultyId) {
      throw new Error('Invalid department selection');
    }

    const divisions = await ctx.db
      .query('divisions')
      .withIndex('by_academicClassId', (q) => q.eq('academicClassId', args.academicClassId))
      .collect();
    if (divisions.length > 0 && args.divisionId === undefined) {
      throw new Error('Please select a division');
    }
    if (args.divisionId !== undefined) {
      const division = await ctx.db.get(args.divisionId);
      if (division === null || division.academicClassId !== args.academicClassId) {
        throw new Error('Invalid division selection');
      }
    }

    await ctx.db.patch(profile._id, {
      facultyId: args.facultyId,
      departmentId: args.departmentId,
      programId: args.programId,
      academicClassId: args.academicClassId,
      divisionId: args.divisionId,
    });

    if (academicClass._id !== profile.academicClassId) {
      const reminders = await ctx.db
        .query('personalReminders')
        .withIndex('by_userId_and_semesterId', (q) => q.eq('userId', userId))
        .collect();
      for (const reminder of reminders) {
        if (reminder.courseId === undefined) {
          continue;
        }
        const course = await ctx.db.get(reminder.courseId);
        if (course === null || course.academicClassId !== args.academicClassId) {
          await ctx.db.patch(reminder._id, { courseId: undefined });
        }
      }
    }
  },
});

// Written only by hooks/useAlertsSync.ts, after it finishes checking semesterActivities
// for rows to turn into NEW_EVENT alerts — marks "caught up to here" so the next sync
// pass only looks at what's published after this point, not the whole catalogue again.
export const updateLastSeenAlertsAt = mutation({
  args: { lastSeenAlertsAt: v.number() },
  handler: async (ctx, { lastSeenAlertsAt }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated');
    }
    const profile = await requireMyProfile(ctx, userId);
    await ctx.db.patch(profile._id, { lastSeenAlertsAt });
  },
});
