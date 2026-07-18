import { internalMutation } from './_generated/server';

// Dev-only seeding. The Academic Admin app owns this data going forward — there is no
// admin UI in this repo (deliberately out of scope, see AGENTS.md). All three functions
// are idempotent so they're safe to re-run.

export const seedInstitution = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('institutions').first();
    if (existing !== null) {
      return existing._id;
    }
    // Domain verified against ktu.edu.gh's own site and identity.ktu.edu.gh portal,
    // not invented — confirm before relying on it for anything real.
    return await ctx.db.insert('institutions', {
      name: 'Koforidua Technical University',
      emailDomain: 'ktu.edu.gh',
    });
  },
});

// Minimal fixture covering the cases Profile Setup's cascade needs to handle: a
// program with two levels, a level offering both sessions, a divided class, and an
// undivided one. Not real KTU data — for exercising the onboarding flow only.
export const seedTestAcademicStructure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingFaculty = await ctx.db.query('faculties').first();
    if (existingFaculty !== null) {
      return existingFaculty._id;
    }

    const institution = await ctx.db.query('institutions').first();
    if (institution === null) {
      throw new Error('Run seedInstitution first');
    }

    const facultyId = await ctx.db.insert('faculties', {
      institutionId: institution._id,
      name: 'Faculty of Applied Sciences and Technology',
    });
    const departmentId = await ctx.db.insert('departments', {
      facultyId,
      name: 'Computer Science',
    });
    const programId = await ctx.db.insert('programs', {
      departmentId,
      name: 'HND Computer Science',
    });

    const level100Regular = await ctx.db.insert('academicClasses', {
      programId,
      level: 100,
      session: 'REGULAR',
    });
    await ctx.db.insert('divisions', { academicClassId: level100Regular, label: 'A' });
    await ctx.db.insert('divisions', { academicClassId: level100Regular, label: 'B' });

    await ctx.db.insert('academicClasses', { programId, level: 200, session: 'REGULAR' });
    await ctx.db.insert('academicClasses', { programId, level: 200, session: 'WEEKEND' });

    return facultyId;
  },
});

// A single active semester so onboarded students actually reach (protected) instead of
// staying on the waiting screen. Not real admin-published data — the Academic Admin app
// owns this for real once it exists. Idempotent.
export const seedActiveSemester = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();
    if (existing !== null) {
      return existing._id;
    }
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    return await ctx.db.insert('semesters', {
      title: 'First Semester 2025/2026',
      startDate: now - 6 * week,
      endDate: now + 10 * week,
      isActive: true,
    });
  },
});
