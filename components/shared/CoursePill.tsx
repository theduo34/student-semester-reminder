import { Text, View } from 'react-native';

type CoursePillProps = {
  courseCode: string;
  courseTitle: string;
  /** Raw CSS colour from the course's colourTag — same field ActivityCard's dot uses. */
  colour: string;
};

// A course-context chip: code + title behind a neutral pill, with a small dot in the
// course's own colourTag rather than tinting the whole pill background with it — the
// tag is stored as an arbitrary CSS colour string (schema has no format guarantee), so
// alpha-blending it into a background isn't safe, but using it as an opaque dot/text
// colour (same as ActivityCard's dot) always is. Second usage of this shape (list-card
// dots being the first), extracted per the reuse-first rule rather than copied again.
export function CoursePill({ courseCode, courseTitle, colour }: CoursePillProps) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-surface-secondary px-3 py-1">
      <View className="size-2 rounded-full" style={{ backgroundColor: colour }} />
      <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
        {courseCode} — {courseTitle}
      </Text>
    </View>
  );
}
