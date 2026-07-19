import { ControlField, Label } from 'heroui-native';
import { Text, View } from 'react-native';

import { CourseSelect } from '@/components/shared/CourseSelect';
import { PrioritySelector, Priority } from '@/components/shared/PrioritySelector';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { TextField } from '@/components/ui/TextField';
import { Id } from '@/convex/_generated/dataModel';

export type ReminderFormValues = {
  title: string;
  description: string;
  courseId: Id<'courses'> | null;
  dueDate: Date;
  startTime: Date;
  /** null = "Add end time" is off, a single-moment reminder — see schema's endTime comment. */
  endTime: Date | null;
  priority: Priority;
};

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

// Shared validity check so Add and Edit gate their ModalHeader Save button identically
// without duplicating the rule twice.
export function isReminderFormValid(values: ReminderFormValues, minimumDueDate?: Date): boolean {
  if (values.title.trim().length === 0) {
    return false;
  }
  if (values.endTime !== null && values.endTime.getTime() <= values.startTime.getTime()) {
    return false;
  }
  if (minimumDueDate !== undefined && startOfDay(values.dueDate) < startOfDay(minimumDueDate)) {
    return false;
  }
  return true;
}

type ReminderFormProps = {
  semesterId: Id<'semesters'>;
  values: ReminderFormValues;
  onChange: (patch: Partial<ReminderFormValues>) => void;
  /** Passed on create (today) to block past dates; omitted on edit so past reminders stay correctable. */
  minimumDueDate?: Date;
};

// The one reminder form body, shared by Add and Edit — see CLAUDE.md. The only
// difference between the two call sites is minimumDueDate (create enforces "today or
// later", edit allows past dates to be corrected) and whatever the screen does with the
// resulting values on save; the fields, order, and validation are identical.
export function ReminderForm({ semesterId, values, onChange, minimumDueDate }: ReminderFormProps) {
  const endTimeEnabled = values.endTime !== null;
  const dueDateInvalid =
    minimumDueDate !== undefined && startOfDay(values.dueDate) < startOfDay(minimumDueDate);
  const endTimeInvalid =
    values.endTime !== null && values.endTime.getTime() <= values.startTime.getTime();

  return (
    <View className="gap-4 pt-2">
      <TextField
        label="Title"
        value={values.title}
        onChangeText={(title) => onChange({ title })}
        placeholder="e.g. Review chapter 4"
        isRequired
      />
      <TextField
        label="Description"
        value={values.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="Add any notes (optional)"
        multiline
      />
      <CourseSelect
        semesterId={semesterId}
        courseId={values.courseId}
        onChange={(courseId) => onChange({ courseId })}
      />

      <View className="gap-1">
        <DateTimeField
          label="Date"
          mode="date"
          value={values.dueDate}
          onChange={(dueDate) => onChange({ dueDate })}
          minimumDate={minimumDueDate}
        />
        {dueDateInvalid ? <Text className="text-sm text-danger">Due date must be today or later.</Text> : null}
      </View>

      <DateTimeField
        label={endTimeEnabled ? 'Starts at' : 'Time'}
        mode="time"
        value={values.startTime}
        onChange={(startTime) => onChange({ startTime })}
      />

      <ControlField
        isSelected={endTimeEnabled}
        onSelectedChange={(enabled) =>
          onChange({ endTime: enabled ? new Date(values.startTime.getTime() + 60 * 60 * 1000) : null })
        }>
        <Label className="flex-1">Add end time</Label>
        <ControlField.Indicator />
      </ControlField>

      {endTimeEnabled && values.endTime !== null ? (
        <View className="gap-1">
          <DateTimeField
            label="Ends at"
            mode="time"
            value={values.endTime}
            onChange={(endTime) => onChange({ endTime })}
          />
          {endTimeInvalid ? <Text className="text-sm text-danger">End time must be after start time.</Text> : null}
        </View>
      ) : null}

      <PrioritySelector value={values.priority} onChange={(priority) => onChange({ priority })} />
    </View>
  );
}
