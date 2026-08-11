import { v } from 'convex/values';

import { requireAdmin, resolveAdminInstitutionId } from './adminAuth';
import { Id } from './_generated/dataModel';
import { MutationCtx, query, QueryCtx, mutation } from './_generated/server';
import { sessionValidator } from './schema';

// Institutional hierarchy: Institution -> Faculty -> Department -> Program ->
// academicClass (Level+Session) -> Division (optional). Admin-published — read
// queries are open to any signed-in caller (every student needs these for Profile
// Setup/cascading edits), but every write below is gated by requireAdmin (see
// convex/adminAuth.ts). See AGENTS.md for the full model.

export const listFaculties = query({
  args: {},
  handler: async (ctx) => {
    const institution = await ctx.db.query('institutions').first();
    if (institution === null) {
      return [];
    }
    return ctx.db
      .query('faculties')
      .withIndex('by_institutionId', (q) => q.eq('institutionId', institution._id))
      .collect();
  },
});

export const createFaculty = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const admin = await requireAdmin(ctx);
    const institutionId = await resolveAdminInstitutionId(ctx, admin);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Faculty name cannot be empty');
    }
    const existing = await ctx.db
      .query('faculties')
      .withIndex('by_institutionId', (q) => q.eq('institutionId', institutionId))
      .collect();
    if (existing.some((faculty) => faculty.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A faculty with this name already exists');
    }
    return await ctx.db.insert('faculties', { institutionId, name: trimmed });
  },
});

export const updateFaculty = mutation({
  args: { facultyId: v.id('faculties'), name: v.string() },
  handler: async (ctx, { facultyId, name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Faculty name cannot be empty');
    }
    const faculty = await ctx.db.get(facultyId);
    if (faculty === null) {
      throw new Error('Faculty not found');
    }
    await ctx.db.patch(facultyId, { name: trimmed });
  },
});

export const removeFaculty = mutation({
  args: { facultyId: v.id('faculties') },
  handler: async (ctx, { facultyId }) => {
    await requireAdmin(ctx);
    const hasDepartments = await ctx.db
      .query('departments')
      .withIndex('by_facultyId', (q) => q.eq('facultyId', facultyId))
      .first();
    if (hasDepartments !== null) {
      throw new Error('Cannot delete a faculty that still has departments');
    }
    await ctx.db.delete(facultyId);
  },
});

export const listDepartmentsByFaculty = query({
  args: { facultyId: v.id('faculties') },
  handler: async (ctx, { facultyId }) => {
    return ctx.db
      .query('departments')
      .withIndex('by_facultyId', (q) => q.eq('facultyId', facultyId))
      .collect();
  },
});

export const createDepartment = mutation({
  args: { facultyId: v.id('faculties'), name: v.string() },
  handler: async (ctx, { facultyId, name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Department name cannot be empty');
    }
    const faculty = await ctx.db.get(facultyId);
    if (faculty === null) {
      throw new Error('Faculty not found');
    }
    const existing = await ctx.db
      .query('departments')
      .withIndex('by_facultyId', (q) => q.eq('facultyId', facultyId))
      .collect();
    if (existing.some((department) => department.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A department with this name already exists in this faculty');
    }
    return await ctx.db.insert('departments', { facultyId, name: trimmed });
  },
});

export const updateDepartment = mutation({
  args: { departmentId: v.id('departments'), name: v.string() },
  handler: async (ctx, { departmentId, name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Department name cannot be empty');
    }
    const department = await ctx.db.get(departmentId);
    if (department === null) {
      throw new Error('Department not found');
    }
    await ctx.db.patch(departmentId, { name: trimmed });
  },
});

export const removeDepartment = mutation({
  args: { departmentId: v.id('departments') },
  handler: async (ctx, { departmentId }) => {
    await requireAdmin(ctx);
    const hasPrograms = await ctx.db
      .query('programs')
      .withIndex('by_departmentId', (q) => q.eq('departmentId', departmentId))
      .first();
    if (hasPrograms !== null) {
      throw new Error('Cannot delete a department that still has programs');
    }
    await ctx.db.delete(departmentId);
  },
});

export const listProgramsByDepartment = query({
  args: { departmentId: v.id('departments') },
  handler: async (ctx, { departmentId }) => {
    return ctx.db
      .query('programs')
      .withIndex('by_departmentId', (q) => q.eq('departmentId', departmentId))
      .collect();
  },
});

export const createProgram = mutation({
  args: { departmentId: v.id('departments'), name: v.string() },
  handler: async (ctx, { departmentId, name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Program name cannot be empty');
    }
    const department = await ctx.db.get(departmentId);
    if (department === null) {
      throw new Error('Department not found');
    }
    const existing = await ctx.db
      .query('programs')
      .withIndex('by_departmentId', (q) => q.eq('departmentId', departmentId))
      .collect();
    if (existing.some((program) => program.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A program with this name already exists in this department');
    }
    return await ctx.db.insert('programs', { departmentId, name: trimmed });
  },
});

export const updateProgram = mutation({
  args: { programId: v.id('programs'), name: v.string() },
  handler: async (ctx, { programId, name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Program name cannot be empty');
    }
    const program = await ctx.db.get(programId);
    if (program === null) {
      throw new Error('Program not found');
    }
    await ctx.db.patch(programId, { name: trimmed });
  },
});

export const removeProgram = mutation({
  args: { programId: v.id('programs') },
  handler: async (ctx, { programId }) => {
    await requireAdmin(ctx);
    const hasClasses = await ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) => q.eq('programId', programId))
      .first();
    if (hasClasses !== null) {
      throw new Error('Cannot delete a program that still has academic classes');
    }
    await ctx.db.delete(programId);
  },
});

export const listLevelsByProgram = query({
  args: { programId: v.id('programs') },
  handler: async (ctx, { programId }) => {
    const classes = await ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) => q.eq('programId', programId))
      .collect();
    return Array.from(new Set(classes.map((academicClass) => academicClass.level))).sort(
      (a, b) => a - b,
    );
  },
});

// Full rows (with _id), unlike listLevelsByProgram's distinct-level-numbers-only
// shape — the admin Hierarchy screen needs real academicClasses ids to edit/delete a
// specific row, which the two Profile-Setup-cascade queries above were never built to
// provide.
export const listClassesByProgram = query({
  args: { programId: v.id('programs') },
  handler: async (ctx, { programId }) => {
    return ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) => q.eq('programId', programId))
      .collect();
  },
});

export const listSessionsByProgramAndLevel = query({
  args: { programId: v.id('programs'), level: v.number() },
  handler: async (ctx, { programId, level }) => {
    const classes = await ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) =>
        q.eq('programId', programId).eq('level', level),
      )
      .collect();
    return Array.from(new Set(classes.map((academicClass) => academicClass.session)));
  },
});

export const getClassByProgramLevelSession = query({
  args: { programId: v.id('programs'), level: v.number(), session: sessionValidator },
  handler: async (ctx, { programId, level, session }) => {
    return ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) =>
        q.eq('programId', programId).eq('level', level).eq('session', session),
      )
      .unique();
  },
});

// courses/studentProfiles have no index on academicClassId — full-table scans, same
// "fine at this app's demo scale, flagged not fixed" posture as the overdue-sweep
// queries in courseActivities.ts/personalReminders.ts. divisions does have an index,
// checked first since it's the cheap case.
async function academicClassHasDependents(ctx: QueryCtx | MutationCtx, academicClassId: Id<'academicClasses'>) {
  const division = await ctx.db
    .query('divisions')
    .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClassId))
    .first();
  if (division !== null) {
    return true;
  }
  const [courses, profiles] = await Promise.all([
    ctx.db.query('courses').collect(),
    ctx.db.query('studentProfiles').collect(),
  ]);
  return (
    courses.some((course) => course.academicClassId === academicClassId) ||
    profiles.some((profile) => profile.academicClassId === academicClassId)
  );
}

export const createAcademicClass = mutation({
  args: { programId: v.id('programs'), level: v.number(), session: sessionValidator },
  handler: async (ctx, { programId, level, session }) => {
    await requireAdmin(ctx);
    const program = await ctx.db.get(programId);
    if (program === null) {
      throw new Error('Program not found');
    }
    const existing = await ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) =>
        q.eq('programId', programId).eq('level', level).eq('session', session),
      )
      .unique();
    if (existing !== null) {
      throw new Error('A class with this Program, Level, and Session already exists');
    }
    return await ctx.db.insert('academicClasses', { programId, level, session });
  },
});

// Level/session/program together are this row's identity — editing or removing it is
// only allowed while nothing downstream depends on it yet (see convex/adminAuth.ts's
// module comment and the plan this shipped under). A guided reassignment flow (like
// studentProfiles.updateAcademicHierarchy's orphan-nulling on the student side) is a
// bigger feature, deliberately not built here — blocking is the safe default.
export const updateAcademicClass = mutation({
  args: { academicClassId: v.id('academicClasses'), level: v.number(), session: sessionValidator },
  handler: async (ctx, { academicClassId, level, session }) => {
    await requireAdmin(ctx);
    const academicClass = await ctx.db.get(academicClassId);
    if (academicClass === null) {
      throw new Error('Class not found');
    }
    if (await academicClassHasDependents(ctx, academicClassId)) {
      throw new Error('Cannot edit a class that already has divisions, courses, or students');
    }
    const existing = await ctx.db
      .query('academicClasses')
      .withIndex('by_program_level_session', (q) =>
        q.eq('programId', academicClass.programId).eq('level', level).eq('session', session),
      )
      .unique();
    if (existing !== null && existing._id !== academicClassId) {
      throw new Error('A class with this Program, Level, and Session already exists');
    }
    await ctx.db.patch(academicClassId, { level, session });
  },
});

export const removeAcademicClass = mutation({
  args: { academicClassId: v.id('academicClasses') },
  handler: async (ctx, { academicClassId }) => {
    await requireAdmin(ctx);
    const academicClass = await ctx.db.get(academicClassId);
    if (academicClass === null) {
      throw new Error('Class not found');
    }
    if (await academicClassHasDependents(ctx, academicClassId)) {
      throw new Error('Cannot delete a class that still has divisions, courses, or students');
    }
    await ctx.db.delete(academicClassId);
  },
});

// Resolves the denormalized academicClassId on studentProfiles back into a
// human-readable "Program name, Level X" for display (Settings' profile card).
export const getClassDetails = query({
  args: { academicClassId: v.id('academicClasses') },
  handler: async (ctx, { academicClassId }) => {
    const academicClass = await ctx.db.get(academicClassId);
    if (academicClass === null) {
      return null;
    }
    const program = await ctx.db.get(academicClass.programId);
    if (program === null) {
      return null;
    }
    return { programName: program.name, level: academicClass.level, session: academicClass.session };
  },
});

// Resolves an entire studentProfile's hierarchy ids into human-readable names in one
// call — the profile detail screen's ACADEMIC group and the cascading edit picker's
// pre-fill both need this rather than one query per field.
export const getFullHierarchy = query({
  args: {
    facultyId: v.id('faculties'),
    departmentId: v.id('departments'),
    academicClassId: v.id('academicClasses'),
    divisionId: v.optional(v.id('divisions')),
  },
  handler: async (ctx, { facultyId, departmentId, academicClassId, divisionId }) => {
    const [faculty, department, academicClass, division] = await Promise.all([
      ctx.db.get(facultyId),
      ctx.db.get(departmentId),
      ctx.db.get(academicClassId),
      divisionId ? ctx.db.get(divisionId) : Promise.resolve(null),
    ]);
    if (faculty === null || department === null || academicClass === null) {
      return null;
    }
    const program = await ctx.db.get(academicClass.programId);
    if (program === null) {
      return null;
    }
    return {
      facultyName: faculty.name,
      departmentName: department.name,
      programName: program.name,
      level: academicClass.level,
      session: academicClass.session,
      divisionLabel: division?.label,
    };
  },
});

export const listDivisionsByClass = query({
  args: { academicClassId: v.id('academicClasses') },
  handler: async (ctx, { academicClassId }) => {
    return ctx.db
      .query('divisions')
      .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClassId))
      .collect();
  },
});

export const createDivision = mutation({
  args: { academicClassId: v.id('academicClasses'), label: v.string() },
  handler: async (ctx, { academicClassId, label }) => {
    await requireAdmin(ctx);
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      throw new Error('Division label cannot be empty');
    }
    const academicClass = await ctx.db.get(academicClassId);
    if (academicClass === null) {
      throw new Error('Class not found');
    }
    const existing = await ctx.db
      .query('divisions')
      .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClassId))
      .collect();
    if (existing.some((division) => division.label.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A division with this label already exists in this class');
    }
    return await ctx.db.insert('divisions', { academicClassId, label: trimmed });
  },
});

export const updateDivision = mutation({
  args: { divisionId: v.id('divisions'), label: v.string() },
  handler: async (ctx, { divisionId, label }) => {
    await requireAdmin(ctx);
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      throw new Error('Division label cannot be empty');
    }
    const division = await ctx.db.get(divisionId);
    if (division === null) {
      throw new Error('Division not found');
    }
    await ctx.db.patch(divisionId, { label: trimmed });
  },
});

export const removeDivision = mutation({
  args: { divisionId: v.id('divisions') },
  handler: async (ctx, { divisionId }) => {
    await requireAdmin(ctx);
    // courseSections/studentProfiles have no index on divisionId — full-table scans,
    // same posture as academicClassHasDependents above.
    const [sections, profiles] = await Promise.all([
      ctx.db.query('courseSections').collect(),
      ctx.db.query('studentProfiles').collect(),
    ]);
    const inUse =
      sections.some((section) => section.divisionId === divisionId) ||
      profiles.some((profile) => profile.divisionId === divisionId);
    if (inUse) {
      throw new Error('Cannot delete a division that still has course sections or students');
    }
    await ctx.db.delete(divisionId);
  },
});
