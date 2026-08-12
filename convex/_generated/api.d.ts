/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as academicStructure from "../academicStructure.js";
import type * as academicYears from "../academicYears.js";
import type * as activities from "../activities.js";
import type * as activityCategories from "../activityCategories.js";
import type * as adminAuth from "../adminAuth.js";
import type * as adminDashboard from "../adminDashboard.js";
import type * as admins from "../admins.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as courseActivities from "../courseActivities.js";
import type * as courseSections from "../courseSections.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as documentImport from "../documentImport.js";
import type * as documentUploads from "../documentUploads.js";
import type * as http from "../http.js";
import type * as institutions from "../institutions.js";
import type * as notificationPreferences from "../notificationPreferences.js";
import type * as overdueSweep from "../overdueSweep.js";
import type * as personalReminders from "../personalReminders.js";
import type * as pushDelivery from "../pushDelivery.js";
import type * as pushTokens from "../pushTokens.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as semesterActivities from "../semesterActivities.js";
import type * as semesters from "../semesters.js";
import type * as studentProfiles from "../studentProfiles.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  academicStructure: typeof academicStructure;
  academicYears: typeof academicYears;
  activities: typeof activities;
  activityCategories: typeof activityCategories;
  adminAuth: typeof adminAuth;
  adminDashboard: typeof adminDashboard;
  admins: typeof admins;
  alerts: typeof alerts;
  auth: typeof auth;
  courseActivities: typeof courseActivities;
  courseSections: typeof courseSections;
  courses: typeof courses;
  crons: typeof crons;
  documentImport: typeof documentImport;
  documentUploads: typeof documentUploads;
  http: typeof http;
  institutions: typeof institutions;
  notificationPreferences: typeof notificationPreferences;
  overdueSweep: typeof overdueSweep;
  personalReminders: typeof personalReminders;
  pushDelivery: typeof pushDelivery;
  pushTokens: typeof pushTokens;
  reminders: typeof reminders;
  seed: typeof seed;
  semesterActivities: typeof semesterActivities;
  semesters: typeof semesters;
  studentProfiles: typeof studentProfiles;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
