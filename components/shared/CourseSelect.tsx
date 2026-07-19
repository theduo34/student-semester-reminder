import { useQuery } from 'convex/react';
import { Label, Select } from 'heroui-native';
import { View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const NONE_VALUE = 'none';
const NONE_LABEL = 'None — standalone reminder';

type CourseSelectProps = {
  semesterId: Id<'semesters'>;
  courseId: Id<'courses'> | null;
  onChange: (courseId: Id<'courses'> | null) => void;
};

// Dropdown pre-populated from the student's own academicClass course catalogue —
// reappears on both Add and Edit reminder forms. "None" is a real selectable item (not
// just the empty placeholder) so a course already picked can be cleared back to
// standalone; the server independently re-validates whatever comes back against the
// student's class (see personalReminders.ts) rather than trusting this list was
// actually populated correctly.
export function CourseSelect({ semesterId, courseId, onChange }: CourseSelectProps) {
  const courses = useQuery(api.courses.listMyCourses, { semesterId });
  const options = courses ?? [];

  const selectedCourse = options.find((course) => course._id === courseId);
  const value = selectedCourse
    ? { value: selectedCourse._id, label: `${selectedCourse.courseCode} · ${selectedCourse.courseTitle}` }
    : { value: NONE_VALUE, label: NONE_LABEL };

  return (
    <View className="gap-1.5">
      <Label>Course</Label>
      <Select
        value={value}
        onValueChange={(option) => {
          if (option) {
            onChange(option.value === NONE_VALUE ? null : (option.value as Id<'courses'>));
          }
        }}>
        <Select.Trigger className="rounded-md">
          <Select.Value placeholder={NONE_LABEL} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          <Select.Content presentation="popover" width="trigger" className="rounded-md">
            <Select.Item value={NONE_VALUE} label={NONE_LABEL} />
            {options.map((course) => (
              <Select.Item
                key={course._id}
                value={course._id}
                label={`${course.courseCode} · ${course.courseTitle}`}
              />
            ))}
          </Select.Content>
        </Select.Portal>
      </Select>
    </View>
  );
}
