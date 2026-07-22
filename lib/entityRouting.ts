import { Doc } from '@/convex/_generated/dataModel';

// The one entityType -> Activity Details route-`type` mapping, shared by the Alerts
// tab (tapping a row) and hooks/use-notification-observer.ts (tapping a push
// notification) — both land on the same polymorphic
// app/(protected)/activity/[entityId] route, see AGENTS.md's Activity details routing
// section.
export const ENTITY_TYPE_TO_ROUTE_TYPE: Record<
  Doc<'alerts'>['entityType'],
  'course' | 'semester' | 'personal'
> = {
  courseActivities: 'course',
  semesterActivities: 'semester',
  personalReminders: 'personal',
};
