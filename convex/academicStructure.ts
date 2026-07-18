import { v } from 'convex/values';

import { query } from './_generated/server';
import { sessionValidator } from './schema';

// Admin-published institutional hierarchy. Read-only from this app — see AGENTS.md.

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

export const listDepartmentsByFaculty = query({
  args: { facultyId: v.id('faculties') },
  handler: async (ctx, { facultyId }) => {
    return ctx.db
      .query('departments')
      .withIndex('by_facultyId', (q) => q.eq('facultyId', facultyId))
      .collect();
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

export const listDivisionsByClass = query({
  args: { academicClassId: v.id('academicClasses') },
  handler: async (ctx, { academicClassId }) => {
    return ctx.db
      .query('divisions')
      .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClassId))
      .collect();
  },
});
