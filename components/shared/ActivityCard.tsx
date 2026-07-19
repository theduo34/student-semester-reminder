import { ListGroup } from 'heroui-native';
import { Text, View } from 'react-native';

export type ActivityCardProps = {
  /** Drives the personal-indicator dot (personalReminder only) and the no-course fallback colour (semesterActivity always renders critical-red, never personal-purple — it's an institutional event, not the student's own). */
  kind: 'courseActivity' | 'personalReminder' | 'semesterActivity';
  title: string;
  /** Course title, or undefined for a standalone personal reminder. */
  subtitle?: string;
  startTime: number;
  endTime?: number;
  /** Raw CSS colour from the course's colourTag — present for every courseActivity and for personalReminders tied to a course. Undefined means "use the personal token", the standalone-reminder case. */
  courseColour?: string;
  isCompleted?: boolean;
  /** Calendar's agenda already shows the date once, in its own header line — pass true there so each card isn't repeating it. Home's list spans multiple days and needs it per-row (default). */
  hideDate?: boolean;
  onPress?: () => void;
};

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// One row shape for course activities and personal reminders, wherever a list of them
// appears — Home's dashboard list, Calendar's day agenda, and (later) Alerts. Course
// colour always wins as the accent when present (whether the row is a course activity
// or a course-linked personal reminder); the small "•" only appears on the latter,
// since that's the one case a same-coloured row is actually the student's own to edit
// rather than an admin-published activity. No courseColour at all means a standalone
// personal reminder — falls back to the shared --personal token.
export function ActivityCard({
  kind,
  title,
  subtitle,
  startTime,
  endTime,
  courseColour,
  isCompleted,
  hideDate,
  onPress,
}: ActivityCardProps) {
  const showPersonalIndicator = kind === 'personalReminder' && courseColour !== undefined;
  const timeRange = endTime !== undefined ? `${formatTime(startTime)} – ${formatTime(endTime)}` : formatTime(startTime);
  const fallbackDotClassName = kind === 'semesterActivity' ? 'bg-critical' : 'bg-personal';

  return (
    <ListGroup.Item onPress={onPress} disabled={!onPress}>
      <ListGroup.ItemPrefix>
        <View
          className={courseColour ? undefined : `size-3 rounded-full ${fallbackDotClassName}`}
          style={courseColour ? { width: 12, height: 12, borderRadius: 6, backgroundColor: courseColour } : undefined}
        />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle className={isCompleted ? 'text-muted line-through' : undefined}>
          {showPersonalIndicator ? '• ' : ''}
          {title}
        </ListGroup.ItemTitle>
        {subtitle ? <ListGroup.ItemDescription>{subtitle}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Text className="text-xs text-muted">
          {hideDate ? timeRange : `${formatDate(startTime)} · ${timeRange}`}
        </Text>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}
