import { query } from './_generated/server';
import { requireAdmin, resolveAdminInstitutionId } from './adminAuth';

// Powers termio-admin's Dashboard page — one aggregate read instead of one query per
// stat. Only `faculties` carries `institutionId` directly (see schema.ts); every table
// below it in the hierarchy (departments/programs/academicClasses/courses/
// studentProfiles) has to be scoped by walking down from the institution's faculty set
// and filtering full-table scans against the resulting id sets. Same "fine at demo
// scale, flagged not fixed" posture as academicStructure.ts's dependent-row checks and
// courseActivities.ts's overdue sweep — this app has a handful of faculties/
// departments/programs/classes/courses/students total, not thousands.
export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const institutionId = await resolveAdminInstitutionId(ctx, admin);

    const institution = await ctx.db.get(institutionId);

    const faculties = await ctx.db
      .query('faculties')
      .withIndex('by_institutionId', (q) => q.eq('institutionId', institutionId))
      .collect();
    const facultyIds = new Set(faculties.map((f) => f._id));

    const [allDepartments, allPrograms, allAcademicClasses, allCourses, allStudentProfiles, activeSemester] =
      await Promise.all([
        ctx.db.query('departments').collect(),
        ctx.db.query('programs').collect(),
        ctx.db.query('academicClasses').collect(),
        ctx.db.query('courses').collect(),
        ctx.db.query('studentProfiles').collect(),
        ctx.db
          .query('semesters')
          .withIndex('by_isActive', (q) => q.eq('isActive', true))
          .unique(),
      ]);

    const departments = allDepartments.filter((d) => facultyIds.has(d.facultyId));
    const departmentIds = new Set(departments.map((d) => d._id));

    const programs = allPrograms.filter((p) => departmentIds.has(p.departmentId));
    const programIds = new Set(programs.map((p) => p._id));

    const academicClasses = allAcademicClasses.filter((c) => programIds.has(c.programId));
    const academicClassIds = new Set(academicClasses.map((c) => c._id));

    const courses = allCourses.filter((c) => academicClassIds.has(c.academicClassId));
    const studentProfiles = allStudentProfiles.filter((p) => facultyIds.has(p.facultyId));

    const studentCountByFaculty = new Map<string, number>();
    for (const profile of studentProfiles) {
      studentCountByFaculty.set(profile.facultyId, (studentCountByFaculty.get(profile.facultyId) ?? 0) + 1);
    }

    const facultyBreakdown = faculties
      .map((faculty) => ({
        facultyId: faculty._id,
        name: faculty.name,
        studentCount: studentCountByFaculty.get(faculty._id) ?? 0,
      }))
      .sort((a, b) => b.studentCount - a.studentCount);

    return {
      institution: institution === null ? null : { name: institution.name, emailDomain: institution.emailDomain },
      activeSemester:
        activeSemester === null
          ? null
          : {
              _id: activeSemester._id,
              title: activeSemester.title,
              startDate: activeSemester.startDate,
              endDate: activeSemester.endDate,
            },
      counts: {
        students: studentProfiles.length,
        faculties: faculties.length,
        departments: departments.length,
        courses: courses.length,
      },
      facultyBreakdown,
    };
  },
});
