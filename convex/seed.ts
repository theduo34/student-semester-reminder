import { createAccount } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { internalAction, internalMutation, internalQuery, MutationCtx } from './_generated/server';

// Dev-only seed data — a realistic development/defense-demo fixture, not real KTU data.
// The Academic Admin app owns this data for real once it exists (see AGENTS.md). Every
// function here is idempotent: it looks up rows by a natural key (name/code/combined
// lookup) before inserting, so re-running `npx convex run seed:seedAll` is always safe.
// Never a wipe-and-reseed — that's a separate, deliberately unbuilt destructive script.
// This is also the project's standing convention going forward: any future addition to
// this file follows the same check-before-insert shape, never delete-then-recreate.
//
// All dates are computed relative to `Date.now()` at seed time via `atOffset` below,
// never hardcoded — a hardcoded date drifts stale the moment "today" moves past it.
// Ghana Standard Time is UTC+0 year-round (no DST) and Convex functions run on a UTC
// system clock, so `Date`'s local-timezone setters happen to line up with Ghana
// wall-clock time without extra offset math — that's a coincidence of both sides being
// UTC+0, not a general guarantee; revisit this if the app ever serves students outside
// GMT.

/* -----------------------------------------------------------------------------------
 * FACT-CHECK NOTES (verified against ktu.edu.gh directly, not invented — see the
 * per-field comments below for what's confirmed vs. best-guessed):
 * - Institution name/emailDomain: confirmed (ktu.edu.gh, identity.ktu.edu.gh portal).
 * - "Faculty of Applied Science and Technology", "Faculty of Engineering", "Faculty of
 *   Business and Management Studies": confirmed real KTU faculties, exact names.
 * - "Computer Science Department" (under Applied Science and Technology): confirmed
 *   (fast.ktu.edu.gh/departments/computer-science-department/).
 * - "Mechanical Engineering Department" (under Engineering): confirmed
 *   (foe.ktu.edu.gh/departments/mechanical-engineering-department/).
 * - "Accountancy Department" (under Business and Management Studies): confirmed —
 *   note this corrects an initial "Department of Accounting" assumption; the real name
 *   is "Accountancy", not "Accounting" (fbms.ktu.edu.gh/departments/accountancy-department/).
 * - "Applied Mathematics Department" (under Applied Science and Technology): confirmed
 *   — this corrects an initial "Mathematics and Statistics" assumption; the real
 *   department is Applied Mathematics, not a combined Mathematics-and-Statistics one
 *   (fast.ktu.edu.gh/departments/applied-mathematics-department/).
 * - "HND Computer Science", "BTech Computer Science" (Bachelor of Technology in
 *   Computer Science), "HND Mechanical Engineering", "HND Accountancy": confirmed as
 *   real offered programmes.
 * - Course codes/titles (CS 301, CS 305, ...), course descriptions, and exact activity
 *   titles: illustrative example data for this fictional current semester, not pulled
 *   from a real KTU syllabus — there's nothing to verify here, they're invented by
 *   design.
 * - Index number format: NOT confirmed. KTU's site doesn't publicly document the exact
 *   index-number structure. One third-party forum mentioned an older student-ID example
 *   (04/2015/0000D) — the format used below is loosely inspired by that shape but is a
 *   best guess, not a verified fact. Flagged for correction if the real format is known.
 * ----------------------------------------------------------------------------------- */

const INSTITUTION_NAME = 'Koforidua Technical University';
const INSTITUTION_EMAIL_DOMAIN = 'ktu.edu.gh';

const DEMO_FACULTY = 'Faculty of Applied Science and Technology';
const DEMO_DEPARTMENT = 'Computer Science';
const DEMO_PROGRAM = 'HND Computer Science';
const DEMO_LEVEL = 200;
const DEMO_SESSION = 'REGULAR' as const;

const DEMO_STUDENT = {
  name: 'Ama Owusu',
  authEmail: 'demo@example.com',
  // Dev-only demo credential, meant to be public (README, defense demo) — never a real
  // password, never used outside a dev deployment.
  password: 'demo1234',
  institutionalEmail: 'ama.owusu@ktu.edu.gh',
  // Best-guessed format — see the fact-check note above. Not confirmed against an
  // authoritative KTU source.
  indexNumber: '04/2024/00089',
  phoneNumber: '+233241234567',
};

function atOffset(daysFromToday: number, hour: number, minute: number): number {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/* ------------------------------- natural-key upserts ------------------------------- */

async function requireInstitution(ctx: MutationCtx) {
  const institution = await ctx.db.query('institutions').first();
  if (institution === null) {
    throw new Error('Run seedInstitution first');
  }
  return institution;
}

async function requireActiveSemester(ctx: MutationCtx) {
  const semester = await ctx.db
    .query('semesters')
    .withIndex('by_isActive', (q) => q.eq('isActive', true))
    .unique();
  if (semester === null) {
    throw new Error('Run seedSemester first');
  }
  return semester;
}

async function findFaculty(ctx: MutationCtx, institutionId: Id<'institutions'>, name: string) {
  const faculties = await ctx.db
    .query('faculties')
    .withIndex('by_institutionId', (q) => q.eq('institutionId', institutionId))
    .collect();
  return faculties.find((faculty) => faculty.name === name) ?? null;
}

async function upsertFaculty(ctx: MutationCtx, institutionId: Id<'institutions'>, name: string) {
  const existing = await findFaculty(ctx, institutionId, name);
  return existing !== null ? existing._id : await ctx.db.insert('faculties', { institutionId, name });
}

async function findDepartment(ctx: MutationCtx, facultyId: Id<'faculties'>, name: string) {
  const departments = await ctx.db
    .query('departments')
    .withIndex('by_facultyId', (q) => q.eq('facultyId', facultyId))
    .collect();
  return departments.find((department) => department.name === name) ?? null;
}

async function upsertDepartment(ctx: MutationCtx, facultyId: Id<'faculties'>, name: string) {
  const existing = await findDepartment(ctx, facultyId, name);
  return existing !== null ? existing._id : await ctx.db.insert('departments', { facultyId, name });
}

async function findProgram(ctx: MutationCtx, departmentId: Id<'departments'>, name: string) {
  const programs = await ctx.db
    .query('programs')
    .withIndex('by_departmentId', (q) => q.eq('departmentId', departmentId))
    .collect();
  return programs.find((program) => program.name === name) ?? null;
}

async function upsertProgram(ctx: MutationCtx, departmentId: Id<'departments'>, name: string) {
  const existing = await findProgram(ctx, departmentId, name);
  return existing !== null ? existing._id : await ctx.db.insert('programs', { departmentId, name });
}

async function upsertAcademicClass(
  ctx: MutationCtx,
  programId: Id<'programs'>,
  level: number,
  session: 'REGULAR' | 'WEEKEND',
) {
  const existing = await ctx.db
    .query('academicClasses')
    .withIndex('by_program_level_session', (q) => q.eq('programId', programId).eq('level', level).eq('session', session))
    .unique();
  return existing !== null ? existing._id : await ctx.db.insert('academicClasses', { programId, level, session });
}

async function upsertDivision(ctx: MutationCtx, academicClassId: Id<'academicClasses'>, label: string) {
  const divisions = await ctx.db
    .query('divisions')
    .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClassId))
    .collect();
  const existing = divisions.find((division) => division.label === label);
  return existing !== undefined ? existing._id : await ctx.db.insert('divisions', { academicClassId, label });
}

// Re-derives a class by walking Faculty -> Department -> Program -> academicClass by
// name/level/session, rather than threading ids through from seedHierarchy's return
// value — keeps every seed function independently re-runnable (e.g. `npx convex run
// seed:seedCourses` alone works fine as long as seedHierarchy has already run), not
// coupled to a single seedAll call order.
async function resolveClass(
  ctx: MutationCtx,
  facultyName: string,
  departmentName: string,
  programName: string,
  level: number,
  session: 'REGULAR' | 'WEEKEND',
) {
  const institution = await requireInstitution(ctx);
  const faculty = await findFaculty(ctx, institution._id, facultyName);
  if (faculty === null) throw new Error(`Run seedHierarchy first (missing faculty: ${facultyName})`);
  const department = await findDepartment(ctx, faculty._id, departmentName);
  if (department === null) throw new Error(`Run seedHierarchy first (missing department: ${departmentName})`);
  const program = await findProgram(ctx, department._id, programName);
  if (program === null) throw new Error(`Run seedHierarchy first (missing program: ${programName})`);
  const academicClass = await ctx.db
    .query('academicClasses')
    .withIndex('by_program_level_session', (q) => q.eq('programId', program._id).eq('level', level).eq('session', session))
    .unique();
  if (academicClass === null) {
    throw new Error(`Run seedHierarchy first (missing class: ${programName} L${level} ${session})`);
  }
  return { faculty, department, program, academicClass };
}

async function findCourseByCode(
  ctx: MutationCtx,
  semesterId: Id<'semesters'>,
  academicClassId: Id<'academicClasses'>,
  courseCode: string,
) {
  const courses = await ctx.db
    .query('courses')
    .withIndex('by_semesterId_and_academicClassId', (q) => q.eq('semesterId', semesterId).eq('academicClassId', academicClassId))
    .collect();
  return courses.find((course) => course.courseCode === courseCode) ?? null;
}

async function upsertCourse(
  ctx: MutationCtx,
  semesterId: Id<'semesters'>,
  academicClassId: Id<'academicClasses'>,
  courseCode: string,
  courseTitle: string,
  colourTag: string,
) {
  const existing = await findCourseByCode(ctx, semesterId, academicClassId, courseCode);
  return existing !== null
    ? existing._id
    : await ctx.db.insert('courses', { semesterId, academicClassId, courseCode, courseTitle, colourTag });
}

async function upsertCourseSection(
  ctx: MutationCtx,
  courseId: Id<'courses'>,
  divisionId: Id<'divisions'> | undefined,
  scheduleDays: string[],
  scheduleTime: string,
  venue: string,
) {
  const sections = await ctx.db
    .query('courseSections')
    .withIndex('by_courseId', (q) => q.eq('courseId', courseId))
    .collect();
  const existing = sections.find((section) => section.divisionId === divisionId);
  if (existing !== undefined) return existing._id;
  return ctx.db.insert('courseSections', { courseId, divisionId, scheduleDays, scheduleTime, venue });
}

async function upsertSemesterActivity(
  ctx: MutationCtx,
  semesterId: Id<'semesters'>,
  title: string,
  description: string,
  date: number,
) {
  const existing = await ctx.db
    .query('semesterActivities')
    .withIndex('by_semesterId', (q) => q.eq('semesterId', semesterId))
    .collect();
  if (existing.some((row) => row.title === title)) return;
  const semesterActivityId = await ctx.db.insert('semesterActivities', { semesterId, title, description, date });
  // Real push to every student's device — this is the defense demo path (see
  // AGENTS.md's Push architecture section): re-running the seed against the preview
  // deployment delivers an actual notification, not just a row in the alerts table.
  // Scheduled rather than called directly — mutations can't make the external HTTP
  // call a push send needs, only actions can, see convex/pushDelivery.ts.
  await ctx.scheduler.runAfter(0, internal.pushDelivery.notifyNewEvent, {
    semesterActivityId,
    title,
  });
}

async function upsertReminderPreferences(
  ctx: MutationCtx,
  studentId: Id<'users'>,
  priority: 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE',
  intervals: number[],
) {
  const existing = await ctx.db
    .query('reminderPreferences')
    .withIndex('by_studentId_and_priority', (q) => q.eq('studentId', studentId).eq('priority', priority))
    .unique();
  if (existing !== null) return;
  await ctx.db.insert('reminderPreferences', { studentId, priority, intervals });
}

type PersonalReminderSeed = Omit<Doc<'personalReminders'>, '_id' | '_creationTime' | 'isCompleted'>;

async function upsertPersonalReminder(ctx: MutationCtx, reminder: PersonalReminderSeed) {
  const existing = await ctx.db
    .query('personalReminders')
    .withIndex('by_userId_and_semesterId', (q) => q.eq('userId', reminder.userId).eq('semesterId', reminder.semesterId))
    .collect();
  if (existing.some((row) => row.title === reminder.title)) return;
  await ctx.db.insert('personalReminders', { ...reminder, isCompleted: false });
}

type AlertSeed = Omit<Doc<'alerts'>, '_id' | '_creationTime'>;

// Mirrors the exact dedup key convex/alerts.ts#create checks (userId, entityId, kind) —
// deliberately, so a real useAlertsSync pass later can never produce a duplicate of a
// seeded alert either.
async function upsertAlert(ctx: MutationCtx, alert: AlertSeed) {
  const existing = await ctx.db
    .query('alerts')
    .withIndex('by_userId_entityId_kind', (q) =>
      q.eq('userId', alert.userId).eq('entityId', alert.entityId).eq('kind', alert.kind),
    )
    .unique();
  if (existing !== null) return;
  await ctx.db.insert('alerts', alert);
}

/* --------------------------------- seed functions ---------------------------------- */

export const seedInstitution = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('institutions').first();
    if (existing !== null) return existing._id;
    return ctx.db.insert('institutions', { name: INSTITUTION_NAME, emailDomain: INSTITUTION_EMAIL_DOMAIN });
  },
});

// Realistic KTU structure (see the fact-check notes above for what's confirmed vs.
// best-guessed) — three faculties, multiple departments/programs, a mix of divided and
// undivided classes, and one Weekend-session class so both session literals show up.
export const seedHierarchy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const institution = await requireInstitution(ctx);

    const fastId = await upsertFaculty(ctx, institution._id, DEMO_FACULTY);

    const csDeptId = await upsertDepartment(ctx, fastId, DEMO_DEPARTMENT);
    const csHndId = await upsertProgram(ctx, csDeptId, DEMO_PROGRAM);
    const csHnd100 = await upsertAcademicClass(ctx, csHndId, 100, 'REGULAR');
    await upsertDivision(ctx, csHnd100, 'A');
    await upsertDivision(ctx, csHnd100, 'B');
    const csHnd200 = await upsertAcademicClass(ctx, csHndId, DEMO_LEVEL, DEMO_SESSION);
    await upsertDivision(ctx, csHnd200, 'A');
    await upsertDivision(ctx, csHnd200, 'B');
    await upsertDivision(ctx, csHnd200, 'C');
    await upsertAcademicClass(ctx, csHndId, 300, 'REGULAR'); // undivided

    const csBTechId = await upsertProgram(ctx, csDeptId, 'BTech Computer Science');
    await upsertAcademicClass(ctx, csBTechId, 400, 'REGULAR'); // undivided

    const mathDeptId = await upsertDepartment(ctx, fastId, 'Applied Mathematics');
    const mathHndId = await upsertProgram(ctx, mathDeptId, 'HND Applied Mathematics');
    const mathHnd200 = await upsertAcademicClass(ctx, mathHndId, 200, 'REGULAR');
    await upsertDivision(ctx, mathHnd200, 'A');
    await upsertDivision(ctx, mathHnd200, 'B');

    const engId = await upsertFaculty(ctx, institution._id, 'Faculty of Engineering');
    const mechDeptId = await upsertDepartment(ctx, engId, 'Mechanical Engineering');
    const mechHndId = await upsertProgram(ctx, mechDeptId, 'HND Mechanical Engineering');
    const mechHnd200 = await upsertAcademicClass(ctx, mechHndId, 200, 'REGULAR');
    await upsertDivision(ctx, mechHnd200, 'A');
    await upsertDivision(ctx, mechHnd200, 'B');

    const bmsId = await upsertFaculty(ctx, institution._id, 'Faculty of Business and Management Studies');
    const acctDeptId = await upsertDepartment(ctx, bmsId, 'Accountancy');
    const acctHndId = await upsertProgram(ctx, acctDeptId, 'HND Accountancy');
    const acctHnd200Regular = await upsertAcademicClass(ctx, acctHndId, 200, 'REGULAR');
    await upsertDivision(ctx, acctHnd200Regular, 'A');
    await upsertDivision(ctx, acctHnd200Regular, 'B');
    await upsertAcademicClass(ctx, acctHndId, 200, 'WEEKEND'); // undivided
  },
});

// Lands "today" roughly halfway through the semester (matches the wireframes'
// "64% · 9 weeks remaining" progress-card framing).
export const seedSemester = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('semesters')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .unique();
    if (existing !== null) return existing._id;
    return ctx.db.insert('semesters', {
      title: '2025/2026 Semester 2',
      startDate: atOffset(-56, 0, 0), // 8 weeks before today
      endDate: atOffset(63, 0, 0), // 9 weeks after today
      isActive: true,
    });
  },
});

type CourseSectionSeed = {
  divisionLabel?: string;
  days: string[];
  time: string;
  venue: string;
};

type CourseSeed = {
  code: string;
  title: string;
  colour: string;
  faculty: string;
  department: string;
  program: string;
  level: number;
  session: 'REGULAR' | 'WEEKEND';
  sections: CourseSectionSeed[];
};

const COURSES: CourseSeed[] = [
  {
    code: 'CS 301',
    title: 'Database Systems',
    colour: '#2563EB',
    faculty: DEMO_FACULTY,
    department: DEMO_DEPARTMENT,
    program: DEMO_PROGRAM,
    level: DEMO_LEVEL,
    session: DEMO_SESSION,
    sections: [
      { divisionLabel: 'A', days: ['Monday', 'Wednesday'], time: '08:00 – 10:00', venue: 'Block C, Room 12' },
      { divisionLabel: 'B', days: ['Monday', 'Wednesday'], time: '10:00 – 12:00', venue: 'Block C, Room 12' },
    ],
  },
  {
    code: 'CS 305',
    title: 'Software Engineering',
    colour: '#DB2777',
    faculty: DEMO_FACULTY,
    department: DEMO_DEPARTMENT,
    program: DEMO_PROGRAM,
    level: DEMO_LEVEL,
    session: DEMO_SESSION,
    sections: [
      { divisionLabel: 'A', days: ['Tuesday', 'Thursday'], time: '09:00 – 11:00', venue: 'ICT Block, Lab 3' },
      { divisionLabel: 'B', days: ['Tuesday', 'Thursday'], time: '13:00 – 15:00', venue: 'ICT Block, Lab 3' },
    ],
  },
  {
    code: 'CS 310',
    title: 'Networking',
    colour: '#0D9488',
    faculty: DEMO_FACULTY,
    department: DEMO_DEPARTMENT,
    program: DEMO_PROGRAM,
    level: DEMO_LEVEL,
    session: DEMO_SESSION,
    sections: [{ divisionLabel: 'A', days: ['Wednesday'], time: '13:00 – 15:00', venue: 'Block C, Room 5' }],
  },
  {
    // Undivided — no divisionLabel — proves the "whole class, no division" section path.
    code: 'CS 320',
    title: 'Web Design',
    colour: '#D97706',
    faculty: DEMO_FACULTY,
    department: DEMO_DEPARTMENT,
    program: DEMO_PROGRAM,
    level: DEMO_LEVEL,
    session: DEMO_SESSION,
    sections: [{ days: ['Friday'], time: '09:00 – 12:00', venue: 'ICT Block, Lab 1' }],
  },
  // Other academicClasses — not the demo student's own — so listMyCourses' scoping is
  // provably exercised (these must NOT show up for the demo student).
  {
    code: 'CS 101',
    title: 'Introduction to Programming',
    colour: '#7C3AED',
    faculty: DEMO_FACULTY,
    department: DEMO_DEPARTMENT,
    program: DEMO_PROGRAM,
    level: 100,
    session: 'REGULAR',
    sections: [{ divisionLabel: 'A', days: ['Tuesday'], time: '08:00 – 10:00', venue: 'ICT Block, Lab 2' }],
  },
  {
    code: 'CS 401',
    title: 'Advanced Software Design',
    colour: '#0891B2',
    faculty: DEMO_FACULTY,
    department: DEMO_DEPARTMENT,
    program: 'BTech Computer Science',
    level: 400,
    session: 'REGULAR',
    sections: [{ days: ['Thursday'], time: '14:00 – 16:00', venue: 'ICT Block, Lab 4' }],
  },
  {
    code: 'ME 201',
    title: 'Thermodynamics I',
    colour: '#65A30D',
    faculty: 'Faculty of Engineering',
    department: 'Mechanical Engineering',
    program: 'HND Mechanical Engineering',
    level: 200,
    session: 'REGULAR',
    sections: [{ divisionLabel: 'A', days: ['Tuesday', 'Thursday'], time: '08:00 – 10:00', venue: 'Engineering Block, Workshop 1' }],
  },
];

export const seedCourses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const semester = await requireActiveSemester(ctx);
    for (const course of COURSES) {
      const { academicClass } = await resolveClass(ctx, course.faculty, course.department, course.program, course.level, course.session);
      const courseId = await upsertCourse(ctx, semester._id, academicClass._id, course.code, course.title, course.colour);

      for (const section of course.sections) {
        let divisionId: Id<'divisions'> | undefined;
        if (section.divisionLabel !== undefined) {
          const divisions = await ctx.db
            .query('divisions')
            .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClass._id))
            .collect();
          const division = divisions.find((row) => row.label === section.divisionLabel);
          if (division === undefined) {
            throw new Error(`Missing division ${section.divisionLabel} for ${course.code} — run seedHierarchy first`);
          }
          divisionId = division._id;
        }
        await upsertCourseSection(ctx, courseId, divisionId, section.days, section.time, section.venue);
      }
    }
  },
});

// The demo student's auth account, created pre-verified so no OTP step is needed before
// login — see AGENTS.md/README for the credentials. `createAccount` (from
// @convex-dev/auth/server) needs an action context, not a mutation one, since it runs
// the Password provider's own credential-hashing pipeline (Scrypt via `lucia`) — the
// exact same code path `signIn(..., { flow: "signUp" })` uses from the real app, just
// invoked directly instead of through the client SDK. Everything else about the demo
// student (profile, reminder preferences, personal reminders) is plain ctx.db work and
// lives in seedDemoStudentData, a mutation this action calls once the account exists.
export const seedDemoStudent = internalAction({
  args: {},
  handler: async (ctx): Promise<Id<'users'>> => {
    let userId = await ctx.runQuery(internal.seed.findUserIdByEmail, { email: DEMO_STUDENT.authEmail });
    if (userId === null) {
      const created = await createAccount(ctx, {
        provider: 'password',
        account: { id: DEMO_STUDENT.authEmail, secret: DEMO_STUDENT.password },
        profile: {
          email: DEMO_STUDENT.authEmail,
          name: DEMO_STUDENT.name,
          // Set directly rather than going through the ResendOTP verify flow — this is
          // what makes the account ready-to-log-in with no OTP step for the demo.
          emailVerificationTime: Date.now(),
        },
        shouldLinkViaEmail: true,
      });
      userId = created.user._id;
    }
    await ctx.runMutation(internal.seed.seedDemoStudentData, { userId });
    return userId;
  },
});

export const findUserIdByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', email))
      .unique();
    return user?._id ?? null;
  },
});

// studentProfile + reminderPreferences + personalReminders for the demo student — all
// grouped here (rather than under seedActivities) since they're the demo student's own
// data, not admin-published catalogue data. Requires seedHierarchy, seedSemester, and
// seedCourses to have already run.
export const seedDemoStudentData = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const { faculty, department, program, academicClass } = await resolveClass(
      ctx,
      DEMO_FACULTY,
      DEMO_DEPARTMENT,
      DEMO_PROGRAM,
      DEMO_LEVEL,
      DEMO_SESSION,
    );
    const divisions = await ctx.db
      .query('divisions')
      .withIndex('by_academicClassId', (q) => q.eq('academicClassId', academicClass._id))
      .collect();
    const divisionA = divisions.find((division) => division.label === 'A');
    if (divisionA === undefined) {
      throw new Error('Missing Division A for the demo class — run seedHierarchy first');
    }

    const existingProfile = await ctx.db
      .query('studentProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
    if (existingProfile === null) {
      await ctx.db.insert('studentProfiles', {
        userId,
        facultyId: faculty._id,
        departmentId: department._id,
        programId: program._id,
        academicClassId: academicClass._id,
        divisionId: divisionA._id,
        institutionalEmail: DEMO_STUDENT.institutionalEmail,
        indexNumber: DEMO_STUDENT.indexNumber,
        phoneNumber: DEMO_STUDENT.phoneNumber,
      });
    }

    // The reminder-timing UI only offers a fixed set of presets (30 min / 1 hr / 12 hr /
    // 1 day / 3 days / 1 week / at deadline — see lib/reminderIntervals.ts); there's no
    // "3 hours before" option, so Critical's "[1 day, 3 hours]" from the spec is seeded
    // as [1 day, 1 hour] instead — the closest supported preset — rather than a raw
    // 180-minute value that would render as an ugly unrecognized "180m" in the UI.
    await upsertReminderPreferences(ctx, userId, 'CRITICAL', [1440, 60]);
    await upsertReminderPreferences(ctx, userId, 'IMPORTANT', [1440]);
    await upsertReminderPreferences(ctx, userId, 'FLEXIBLE', [0]);

    const semester = await requireActiveSemester(ctx);
    const cs301 = await findCourseByCode(ctx, semester._id, academicClass._id, 'CS 301');
    const cs305 = await findCourseByCode(ctx, semester._id, academicClass._id, 'CS 305');

    await upsertPersonalReminder(ctx, {
      userId,
      semesterId: semester._id,
      title: 'Buy data bundle',
      dueDate: atOffset(0, 18, 0),
      startTime: atOffset(0, 18, 0),
      priority: 'FLEXIBLE',
    });
    await upsertPersonalReminder(ctx, {
      userId,
      semesterId: semester._id,
      title: 'Study DB Normalization',
      dueDate: atOffset(0, 20, 0),
      startTime: atOffset(0, 20, 0),
      endTime: atOffset(0, 22, 0),
      priority: 'IMPORTANT',
      courseId: cs301?._id,
    });
    await upsertPersonalReminder(ctx, {
      userId,
      semesterId: semester._id,
      title: 'Print CS 305 notes',
      dueDate: atOffset(1, 9, 0),
      startTime: atOffset(1, 9, 0),
      priority: 'FLEXIBLE',
    });
    await upsertPersonalReminder(ctx, {
      userId,
      semesterId: semester._id,
      title: 'Group study session',
      dueDate: atOffset(3, 17, 0),
      startTime: atOffset(3, 17, 0),
      priority: 'FLEXIBLE',
      courseId: cs301?._id,
    });
    await upsertPersonalReminder(ctx, {
      userId,
      semesterId: semester._id,
      title: 'Revise for mid-sem',
      dueDate: atOffset(6, 18, 0),
      startTime: atOffset(6, 18, 0),
      endTime: atOffset(6, 20, 0),
      priority: 'CRITICAL',
      courseId: cs305?._id,
    });
  },
});

type CourseActivitySeed = Omit<Doc<'courseActivities'>, '_id' | '_creationTime' | 'studentId'>;

// Course activities + semester activities across a realistic time distribution —
// overdue, due today (two, at different priorities), due soon, due later, and already
// completed, so every countdown/urgency state on the Activity Details and Calendar
// screens has at least one real example. Requires seedCourses and seedDemoStudent to
// have already run (course activities are scoped to a specific student, see
// convex/courseActivities.ts's schema note).
export const seedActivities = internalMutation({
  args: {},
  handler: async (ctx) => {
    const semester = await requireActiveSemester(ctx);
    const demoUser = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', DEMO_STUDENT.authEmail))
      .unique();
    if (demoUser === null) {
      throw new Error('Run seedDemoStudent first');
    }
    const { academicClass } = await resolveClass(ctx, DEMO_FACULTY, DEMO_DEPARTMENT, DEMO_PROGRAM, DEMO_LEVEL, DEMO_SESSION);

    await upsertSemesterActivity(
      ctx,
      semester._id,
      'Career Fair',
      'Meet employers and explore internship and job opportunities across faculties.',
      atOffset(0, 10, 0),
    );
    await upsertSemesterActivity(
      ctx,
      semester._id,
      'Mid-semester exams begin',
      'Examination period — mid-semester assessments begin across all faculties.',
      atOffset(7, 8, 0),
    );

    const requireCourse = async (code: string) => {
      const course = await findCourseByCode(ctx, semester._id, academicClass._id, code);
      if (course === null) {
        throw new Error(`Run seedCourses first (missing ${code})`);
      }
      return course;
    };
    const cs301 = await requireCourse('CS 301');
    const cs305 = await requireCourse('CS 305');
    const cs310 = await requireCourse('CS 310');
    const cs320 = await requireCourse('CS 320');

    const activities: CourseActivitySeed[] = [
      {
        courseId: cs301._id,
        title: 'Quiz 2',
        activityType: 'QUIZ',
        dueDate: atOffset(0, 16, 0),
        priority: 'CRITICAL',
        status: 'PENDING',
        notes: 'Covers chapters 4–6: normalization forms (1NF–3NF), ER-to-relational mapping. Closed book, 30 minutes.',
      },
      { courseId: cs305._id, title: 'Assignment 3', activityType: 'ASSIGNMENT', dueDate: atOffset(0, 23, 59), priority: 'IMPORTANT', status: 'PENDING' },
      { courseId: cs310._id, title: 'Reading', activityType: 'ASSIGNMENT', dueDate: atOffset(1, 9, 0), priority: 'FLEXIBLE', status: 'PENDING' },
      { courseId: cs301._id, title: 'Group Project Milestone', activityType: 'PROJECT', dueDate: atOffset(2, 23, 59), priority: 'IMPORTANT', status: 'PENDING' },
      { courseId: cs320._id, title: 'Design Critique', activityType: 'PROJECT', dueDate: atOffset(5, 14, 0), priority: 'IMPORTANT', status: 'PENDING' },
      { courseId: cs310._id, title: 'Lab Report', activityType: 'ASSIGNMENT', dueDate: atOffset(7, 23, 59), priority: 'FLEXIBLE', status: 'PENDING' },
      { courseId: cs305._id, title: 'Mid-Semester Exam', activityType: 'EXAM', dueDate: atOffset(12, 9, 0), priority: 'CRITICAL', status: 'PENDING' },
      { courseId: cs320._id, title: 'Portfolio', activityType: 'PROJECT', dueDate: atOffset(18, 23, 59), priority: 'IMPORTANT', status: 'PENDING' },
      // Overdue — still PENDING, so it renders as overdue rather than completed-late.
      { courseId: cs320._id, title: 'Portfolio Draft', activityType: 'PROJECT', dueDate: atOffset(-2, 23, 59), priority: 'IMPORTANT', status: 'PENDING' },
      { courseId: cs301._id, title: 'Quiz 1', activityType: 'QUIZ', dueDate: atOffset(-5, 16, 0), priority: 'IMPORTANT', status: 'COMPLETED' },
      { courseId: cs305._id, title: 'Assignment 2', activityType: 'ASSIGNMENT', dueDate: atOffset(-8, 23, 59), priority: 'IMPORTANT', status: 'COMPLETED' },
    ];

    const existing = await ctx.db
      .query('courseActivities')
      .withIndex('by_studentId', (q) => q.eq('studentId', demoUser._id))
      .collect();
    const existingKeys = new Set(existing.map((row) => `${row.courseId}:${row.title}`));
    for (const activity of activities) {
      if (existingKeys.has(`${activity.courseId}:${activity.title}`)) continue;
      await ctx.db.insert('courseActivities', { studentId: demoUser._id, ...activity });
    }
  },
});

// Realistic mix of read/unread across all four Alerts time buckets (Today/Yesterday/
// This week/Earlier) and all three kinds (REMINDER_FIRED/NEW_EVENT/OVERDUE), so the
// Alerts tab isn't empty during a defense demo. Placed relative to the START of each
// bucket's day boundary rather than a fixed offset from `now` — e.g. "2pm yesterday" is
// always safely inside yesterday's 24h window regardless of what time the seed happens
// to run at, whereas "3 hours ago" could land in the wrong bucket if run in the small
// hours of the morning. Alerts are frozen historical records (see convex/schema.ts's
// alerts table comment) — they don't need to reference an entity whose CURRENT state
// still matches the alert's claim, only a real entityId so tapping through to Activity
// Details works.
export const seedDemoAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const semester = await requireActiveSemester(ctx);
    const demoUser = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', DEMO_STUDENT.authEmail))
      .unique();
    if (demoUser === null) {
      throw new Error('Run seedDemoStudent first');
    }
    const { academicClass } = await resolveClass(ctx, DEMO_FACULTY, DEMO_DEPARTMENT, DEMO_PROGRAM, DEMO_LEVEL, DEMO_SESSION);

    const requireCourseActivity = async (courseCode: string, title: string) => {
      const course = await findCourseByCode(ctx, semester._id, academicClass._id, courseCode);
      if (course === null) throw new Error(`Run seedCourses first (missing ${courseCode})`);
      const rows = await ctx.db
        .query('courseActivities')
        .withIndex('by_studentId', (q) => q.eq('studentId', demoUser._id))
        .collect();
      const activity = rows.find((row) => row.courseId === course._id && row.title === title);
      if (activity === undefined) throw new Error(`Run seedActivities first (missing ${title})`);
      return { activity, course };
    };
    const requirePersonalReminder = async (title: string) => {
      const rows = await ctx.db
        .query('personalReminders')
        .withIndex('by_userId_and_semesterId', (q) => q.eq('userId', demoUser._id).eq('semesterId', semester._id))
        .collect();
      const reminder = rows.find((row) => row.title === title);
      if (reminder === undefined) throw new Error(`Run seedDemoStudent first (missing reminder ${title})`);
      return reminder;
    };
    const requireSemesterActivity = async (title: string) => {
      const rows = await ctx.db
        .query('semesterActivities')
        .withIndex('by_semesterId', (q) => q.eq('semesterId', semester._id))
        .collect();
      const event = rows.find((row) => row.title === title);
      if (event === undefined) throw new Error(`Run seedActivities first (missing event ${title})`);
      return event;
    };

    const now = Date.now();
    const startToday = (() => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const HOUR_MS = 60 * 60 * 1000;
    const todayElapsed = now - startToday;
    const startYesterday = startToday - DAY_MS;
    const startWeek = startToday - 7 * DAY_MS;

    const quiz2 = await requireCourseActivity('CS 301', 'Quiz 2');
    const assignment3 = await requireCourseActivity('CS 305', 'Assignment 3');
    const portfolioDraft = await requireCourseActivity('CS 320', 'Portfolio Draft');
    const studySession = await requirePersonalReminder('Study DB Normalization');
    const dataBundle = await requirePersonalReminder('Buy data bundle');
    const careerFair = await requireSemesterActivity('Career Fair');
    const midSemExams = await requireSemesterActivity('Mid-semester exams begin');

    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'courseActivities',
      entityId: quiz2.activity._id,
      kind: 'REMINDER_FIRED',
      title: 'Quiz 2 is due in 3 hours',
      subtitle: `${quiz2.course.courseCode} — ${quiz2.course.courseTitle}`,
      priority: 'CRITICAL',
      createdAt: now - Math.min(20 * 60 * 1000, todayElapsed * 0.1),
      isRead: false,
    });
    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'semesterActivities',
      entityId: careerFair._id,
      kind: 'NEW_EVENT',
      title: 'New institutional event published',
      subtitle: careerFair.title,
      createdAt: now - Math.min(45 * 60 * 1000, todayElapsed * 0.2),
      isRead: false,
    });
    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'courseActivities',
      entityId: assignment3.activity._id,
      kind: 'OVERDUE',
      title: 'Assignment 3 is overdue',
      subtitle: `${assignment3.course.courseCode} — ${assignment3.course.courseTitle}`,
      priority: 'IMPORTANT',
      createdAt: now - Math.min(3 * HOUR_MS, todayElapsed * 0.6),
      isRead: true,
    });
    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'personalReminders',
      entityId: studySession._id,
      kind: 'REMINDER_FIRED',
      title: 'Reminder: Study DB Normalization',
      subtitle: 'CS 301 — Database Systems',
      priority: 'IMPORTANT',
      createdAt: startYesterday + 14 * HOUR_MS,
      isRead: true,
    });
    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'courseActivities',
      entityId: portfolioDraft.activity._id,
      kind: 'OVERDUE',
      title: 'Portfolio Draft is overdue',
      subtitle: `${portfolioDraft.course.courseCode} — ${portfolioDraft.course.courseTitle}`,
      priority: 'IMPORTANT',
      createdAt: startWeek + 2 * DAY_MS + 10 * HOUR_MS,
      isRead: false,
    });
    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'semesterActivities',
      entityId: midSemExams._id,
      kind: 'NEW_EVENT',
      title: 'New institutional event published',
      subtitle: midSemExams.title,
      createdAt: startWeek + 4 * DAY_MS + 15 * HOUR_MS,
      isRead: true,
    });
    await upsertAlert(ctx, {
      userId: demoUser._id,
      entityType: 'personalReminders',
      entityId: dataBundle._id,
      kind: 'REMINDER_FIRED',
      title: 'Reminder: Buy data bundle',
      subtitle: 'Personal reminder',
      priority: 'FLEXIBLE',
      createdAt: startWeek - 3 * DAY_MS,
      isRead: true,
    });
  },
});

// The single entry point — `npx convex run seed:seedAll '{"iAmSure": true}'`. Convex
// doesn't expose a reliable, documented way for backend code to detect dev vs.
// production (there's no built-in environment flag — the community-recommended
// approach is a hand-set env var per deployment, which this project doesn't have and
// which would still rely on someone remembering to set it correctly). Rather than lean
// on a guessable heuristic (deployment-name/URL pattern matching isn't documented or
// guaranteed stable), this uses the explicit-confirmation gate the task itself sanctions
// as the fallback — simple, reliable, and impossible to trigger by accident.
export const seedAll = internalAction({
  args: { iAmSure: v.boolean() },
  handler: async (ctx, { iAmSure }) => {
    if (!iAmSure) {
      throw new Error(
        'seedAll requires { iAmSure: true }. This inserts demo data, including a ' +
          'password-auth demo account, and is meant for dev deployments only. Run: ' +
          'npx convex run seed:seedAll \'{"iAmSure": true}\'',
      );
    }
    console.warn('[seed] Running seedAll — inserts demo/dev data. Never run this against a real production deployment.');

    await ctx.runMutation(internal.seed.seedInstitution, {});
    await ctx.runMutation(internal.seed.seedHierarchy, {});
    await ctx.runMutation(internal.seed.seedSemester, {});
    await ctx.runMutation(internal.seed.seedCourses, {});
    await ctx.runAction(internal.seed.seedDemoStudent, {});
    await ctx.runMutation(internal.seed.seedActivities, {});
    await ctx.runMutation(internal.seed.seedDemoAlerts, {});

    console.warn(`[seed] Done. Demo login: ${DEMO_STUDENT.authEmail} / ${DEMO_STUDENT.password}`);
  },
});
