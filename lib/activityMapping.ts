import {
  ActivityCardActivityType,
  ActivityCardKind,
  ActivityCardPriority,
} from '@/components/shared/ActivityCard';

// The one unified activity shape both Home and the Academic Year Progress screen map
// their three source queries (courseActivities/personalReminders/semesterActivities)
// into before rendering ActivityCard rows — extracted from Home's own original
// HomeActivity type once the Academic Year screen needed the exact same mapping, per
// AGENTS.md's "never copy component code between two screens" rule.
export type UnifiedActivity = {
  id: string;
  kind: ActivityCardKind;
  type: 'course' | 'personal' | 'semester';
  title: string;
  dueDate: number;
  displayTime: number;
  endTime?: number;
  isCompleted?: boolean;
  priority: ActivityCardPriority;
  activityType?: ActivityCardActivityType;
};

type CourseActivityLike = {
  _id: string;
  title: string;
  dueDate: number;
  status: 'PENDING' | 'COMPLETED';
  priority: ActivityCardPriority;
  activityType: ActivityCardActivityType;
};

type PersonalReminderLike = {
  _id: string;
  title: string;
  dueDate: number;
  startTime: number;
  endTime?: number;
  isCompleted: boolean;
  priority: ActivityCardPriority;
};

type SemesterActivityLike = {
  _id: string;
  title: string;
  date: number;
};

export function mapCourseActivity(activity: CourseActivityLike): UnifiedActivity {
  return {
    id: activity._id,
    kind: 'courseActivity',
    type: 'course',
    title: activity.title,
    dueDate: activity.dueDate,
    displayTime: activity.dueDate,
    isCompleted: activity.status === 'COMPLETED',
    priority: activity.priority,
    activityType: activity.activityType,
  };
}

export function mapPersonalReminder(reminder: PersonalReminderLike): UnifiedActivity {
  return {
    id: reminder._id,
    kind: 'personalReminder',
    type: 'personal',
    title: reminder.title,
    dueDate: reminder.dueDate,
    displayTime: reminder.startTime,
    endTime: reminder.endTime,
    isCompleted: reminder.isCompleted,
    priority: reminder.priority,
  };
}

// Semester activities are always CRITICAL by domain rule, never a stored field — see
// AGENTS.md's Priority model section.
export function mapSemesterActivity(event: SemesterActivityLike): UnifiedActivity {
  return {
    id: event._id,
    kind: 'semesterActivity',
    type: 'semester',
    title: event.title,
    dueDate: event.date,
    displayTime: event.date,
    isCompleted: false,
    priority: 'CRITICAL',
  };
}
