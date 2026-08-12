import { Text, View } from 'react-native';

import { formatScheduleTime, ScheduleEntry } from '@/lib/courseSchedule';

// A recurring class session, not a dated activity — deliberately its own small row,
// not ActivityCard: it has no priority/completion concept and carries venue/lecturer
// instead, which don't fit that component's contract without forcing a fourth
// unrelated variant onto it. Shared by Home and Calendar, the two screens that show a
// day's class schedule.
export function ClassSessionRow({ session }: { session: ScheduleEntry }) {
  return (
    <View className="flex-row items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-3">
      <View className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: session.colourTag }} />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-foreground">
          {session.courseCode} · {session.courseTitle}
        </Text>
        <Text className="text-xs text-muted">
          {formatScheduleTime(session.scheduleTime)}
          {session.venue ? ` · ${session.venue}` : ''}
          {session.lecturer ? ` · ${session.lecturer}` : ''}
        </Text>
      </View>
    </View>
  );
}
