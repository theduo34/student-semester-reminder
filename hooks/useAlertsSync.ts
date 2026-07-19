import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function relativeTimeText(targetMs: number, now: number): string {
  const diff = Math.max(0, targetMs - now);
  const hours = diff / HOUR_MS;
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(diff / MINUTE_MS));
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  if (hours < 24) {
    const roundedHours = Math.round(hours);
    return `${roundedHours} hour${roundedHours === 1 ? '' : 's'}`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function courseSubtitle(course: Doc<'courses'> | undefined, fallback: string): string {
  return course ? `${course.courseCode} — ${course.courseTitle}` : fallback;
}

// The one place all three Alerts-feed creation points live — REMINDER_FIRED, NEW_EVENT,
// OVERDUE (see AGENTS.md's Alerts feed section). Called once from the root layout,
// never per-screen; any future alert source hooks in here too, not scattered across
// individual screens.
//
// No real OS notification scheduling exists in this app yet (see CLAUDE.md's Alerts
// feed note) — REMINDER_FIRED is derived from data instead of literally observing a
// fired notification: has the trigger time implied by the entity's own priority's
// configured reminderPreferences intervals already passed? That's the closest
// approximation of "a reminder fired" available without building real local-
// notification scheduling, which is a separate, larger piece of work than this hook.
//
// Runs on mount (cold start), on every foreground transition (AppState), and on a
// SYNC_INTERVAL_MS timer while the app stays open — covers both "just opened the app"
// and "left the app open past a trigger time" without needing a push mechanism. Reads
// the latest query results via a ref rather than depending on them directly, so the
// effect doesn't re-run (and re-fire redundant, if harmless, mutation calls) on every
// data refresh — only on the three events above.
export function useAlertsSync() {
  const viewer = useQuery(api.users.viewer);
  const profile = useQuery(api.studentProfiles.getMyProfile);
  const semester = useQuery(api.semesters.getActive);
  const courseActivitiesData = useQuery(
    api.courseActivities.listForStudent,
    viewer ? { studentId: viewer._id } : 'skip',
  );
  const personalRemindersData = useQuery(
    api.personalReminders.listMine,
    semester ? { semesterId: semester._id } : 'skip',
  );
  const semesterActivitiesData = useQuery(
    api.alerts.listBySemester,
    semester ? { semesterId: semester._id } : 'skip',
  );
  const coursesData = useQuery(api.courses.listMyCourses, semester ? { semesterId: semester._id } : 'skip');
  const criticalIntervals = useQuery(api.reminders.getPreferences, { priority: 'CRITICAL' });
  const importantIntervals = useQuery(api.reminders.getPreferences, { priority: 'IMPORTANT' });
  const flexibleIntervals = useQuery(api.reminders.getPreferences, { priority: 'FLEXIBLE' });

  const createAlert = useMutation(api.alerts.create);
  const updateLastSeenAlertsAt = useMutation(api.studentProfiles.updateLastSeenAlertsAt);

  const dataRef = useRef({
    profile,
    courseActivitiesData,
    personalRemindersData,
    semesterActivitiesData,
    coursesData,
    criticalIntervals,
    importantIntervals,
    flexibleIntervals,
  });
  dataRef.current = {
    profile,
    courseActivitiesData,
    personalRemindersData,
    semesterActivitiesData,
    coursesData,
    criticalIntervals,
    importantIntervals,
    flexibleIntervals,
  };

  useEffect(() => {
    const runSync = async () => {
      const {
        profile,
        courseActivitiesData,
        personalRemindersData,
        semesterActivitiesData,
        coursesData,
        criticalIntervals,
        importantIntervals,
        flexibleIntervals,
      } = dataRef.current;

      if (
        !profile ||
        !courseActivitiesData ||
        !personalRemindersData ||
        !semesterActivitiesData ||
        !coursesData ||
        !criticalIntervals ||
        !importantIntervals ||
        !flexibleIntervals
      ) {
        return;
      }

      const now = Date.now();
      const intervalsByPriority: Record<'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE', number[]> = {
        CRITICAL: criticalIntervals,
        IMPORTANT: importantIntervals,
        FLEXIBLE: flexibleIntervals,
      };
      const coursesById = new Map(coursesData.map((course) => [course._id, course]));

      for (const activity of courseActivitiesData) {
        if (activity.status !== 'COMPLETED') {
          const course = coursesById.get(activity.courseId);
          const subtitle = courseSubtitle(course, 'Course activity');
          const intervals = intervalsByPriority[activity.priority];
          if (intervals.length > 0 && now >= activity.dueDate - Math.max(...intervals) * 60_000) {
            await createAlert({
              entityType: 'courseActivities',
              entityId: activity._id,
              kind: 'REMINDER_FIRED',
              title: `${activity.title} is due in ${relativeTimeText(activity.dueDate, now)}`,
              subtitle,
              priority: activity.priority,
            });
          }
          if (activity.dueDate < now) {
            await createAlert({
              entityType: 'courseActivities',
              entityId: activity._id,
              kind: 'OVERDUE',
              title: `${activity.title} is overdue`,
              subtitle,
              priority: activity.priority,
            });
          }
        }
      }

      for (const reminder of personalRemindersData) {
        if (!reminder.isCompleted) {
          const course = reminder.courseId ? coursesById.get(reminder.courseId) : undefined;
          const subtitle = courseSubtitle(course, 'Personal reminder');
          const intervals = intervalsByPriority[reminder.priority];
          if (intervals.length > 0 && now >= reminder.startTime - Math.max(...intervals) * 60_000) {
            await createAlert({
              entityType: 'personalReminders',
              entityId: reminder._id,
              kind: 'REMINDER_FIRED',
              title: `Reminder: ${reminder.title}`,
              subtitle,
              priority: reminder.priority,
            });
          }
          if (reminder.dueDate < now) {
            await createAlert({
              entityType: 'personalReminders',
              entityId: reminder._id,
              kind: 'OVERDUE',
              title: `${reminder.title} is overdue`,
              subtitle,
              priority: reminder.priority,
            });
          }
        }
      }

      if (profile.lastSeenAlertsAt === undefined) {
        // First sync ever for this student — baseline to "now" rather than alerting on
        // the entire pre-existing semesterActivities catalogue.
        await updateLastSeenAlertsAt({ lastSeenAlertsAt: now });
      } else {
        const lastSeenAlertsAt = profile.lastSeenAlertsAt;
        const newEvents = semesterActivitiesData.filter((event) => event._creationTime > lastSeenAlertsAt);
        for (const event of newEvents) {
          await createAlert({
            entityType: 'semesterActivities',
            entityId: event._id,
            kind: 'NEW_EVENT',
            title: 'New institutional event published',
            subtitle: event.title,
          });
        }
        await updateLastSeenAlertsAt({ lastSeenAlertsAt: now });
      }
    };

    runSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runSync();
      }
    });
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [createAlert, updateLastSeenAlertsAt]);
}
