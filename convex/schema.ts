import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const priority = v.union(v.literal('CRITICAL'), v.literal('IMPORTANT'), v.literal('FLEXIBLE'));
const activityStatus = v.union(v.literal('PENDING'), v.literal('COMPLETED'));
const entityType = v.union(
  v.literal('courseActivities'),
  v.literal('semesterActivities'),
  v.literal('personalTasks'),
);

export default defineSchema({
  ...authTables,

  // Published by the separate Academic Admin app. Read-only from this app.
  semesters: defineTable({
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
  }).index('by_isActive', ['isActive']),

  // Published by the separate Academic Admin app. Read-only from this app.
  courses: defineTable({
    semesterId: v.id('semesters'),
    courseCode: v.string(),
    courseTitle: v.string(),
    colourTag: v.string(),
    // TODO: firm up shape once the wireframes specify recurring schedule fields.
    schedule: v.optional(v.any()),
  }).index('by_semesterId', ['semesterId']),

  // Owned by this app. Assignments, quizzes, projects, and exams all live in one entity.
  courseActivities: defineTable({
    studentId: v.id('users'),
    courseId: v.id('courses'),
    title: v.string(),
    activityType: v.union(
      v.literal('ASSIGNMENT'),
      v.literal('QUIZ'),
      v.literal('PROJECT'),
      v.literal('EXAM'),
    ),
    dueDate: v.number(),
    priority,
    status: activityStatus,
    notes: v.optional(v.string()),
  })
    .index('by_studentId', ['studentId'])
    .index('by_courseId', ['courseId']),

  // Admin-published institutional events (registration, exam periods, campus events).
  // Always CRITICAL priority and non-dismissible. Read-only from this app.
  semesterActivities: defineTable({
    semesterId: v.id('semesters'),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
  }).index('by_semesterId', ['semesterId']),

  // Owned by this app. The student's own tasks.
  personalTasks: defineTable({
    studentId: v.id('users'),
    title: v.string(),
    dueDate: v.optional(v.number()),
    priority,
    status: activityStatus,
    notes: v.optional(v.string()),
  }).index('by_studentId', ['studentId']),

  // A scheduled local-notification job, tied to any of the entities above via
  // entityId/entityType. Scheduling itself happens on-device via expo-notifications;
  // this table just records what was scheduled so it can be looked up/cancelled.
  reminders: defineTable({
    studentId: v.id('users'),
    entityId: v.string(),
    entityType,
    scheduledFor: v.number(),
    notificationId: v.optional(v.string()),
  })
    .index('by_studentId', ['studentId'])
    .index('by_entityId', ['entityId']),
});
