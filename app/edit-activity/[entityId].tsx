import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModalHeader } from '@/components/shared/ModalHeader';
import { isReminderFormValid, ReminderForm, ReminderFormValues } from '@/components/shared/ReminderForm';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useAppToast } from '@/hooks/use-app-toast';

function toFormValues(reminder: {
  title: string;
  description?: string;
  courseId?: Id<'courses'>;
  dueDate: number;
  startTime: number;
  endTime?: number;
  priority: ReminderFormValues['priority'];
}): ReminderFormValues {
  return {
    title: reminder.title,
    description: reminder.description ?? '',
    courseId: reminder.courseId ?? null,
    dueDate: new Date(reminder.dueDate),
    startTime: new Date(reminder.startTime),
    endTime: reminder.endTime !== undefined ? new Date(reminder.endTime) : null,
    priority: reminder.priority,
  };
}

// Edit Reminder modal. Same form as Add (components/shared/ReminderForm) — the only
// field-level difference is courseId stays editable here (unlike an admin-published
// course activity's locked course field) and dueDate has no "today or later" floor, so a
// past reminder can still be corrected. Headerless at the Stack level (see
// app/_layout.tsx) so ModalHeader owns both the top safe-area edge and Close/Save.
export default function EditReminderScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string }>();
  const reminderId = entityId as Id<'personalReminders'>;
  const router = useRouter();
  const { showSuccess, showError } = useAppToast();

  const reminder = useQuery(api.personalReminders.getMine, { reminderId });
  const updateReminder = useMutation(api.personalReminders.update);
  const removeReminder = useMutation(api.personalReminders.remove);

  const danger = useThemeColor('danger');
  const [values, setValues] = useState<ReminderFormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (reminder && values === null) {
      setValues(toFormValues(reminder));
    }
  }, [reminder, values]);

  useEffect(() => {
    if (reminder === null) {
      showError('Reminder not found');
      router.back();
    }
  }, [reminder, router, showError]);

  const isValid = values !== null && isReminderFormValid(values);

  const handleChange = (patch: Partial<ReminderFormValues>) => {
    setValues((current) => (current ? { ...current, ...patch } : current));
  };

  const handleSave = async () => {
    if (!isValid || values === null || !reminder) {
      return;
    }
    setIsSaving(true);
    try {
      await updateReminder({
        reminderId,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        courseId: values.courseId,
        dueDate: values.dueDate.getTime(),
        startTime: values.startTime.getTime(),
        endTime: values.endTime?.getTime() ?? null,
        priority: values.priority,
      });
      showSuccess('Reminder updated');
      router.back();
    } catch {
      showError('Could not save changes — try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAwareScreen
      bottomInset
      horizontalPadding={12}
      header={
        <ModalHeader
          title="Edit Reminder"
          onClose={() => router.back()}
          onSave={handleSave}
          isSaving={isSaving}
          isSaveDisabled={!isValid}
          saveLabel="Save"
        />
      }
      contentContainerClassName="pb-8">
      {values && reminder ? (
        <>
          <ReminderForm semesterId={reminder.semesterId} values={values} onChange={handleChange} />

          <Pressable
            onPress={() => setIsDeleteDialogOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete reminder"
            className="mt-6 flex-row items-center gap-2 self-start">
            <IconSymbol name="trash" size={18} color={danger} />
            <Text className="font-medium text-danger">Delete reminder</Text>
          </Pressable>
        </>
      ) : null}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete this reminder?"
        message="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await removeReminder({ reminderId });
            showSuccess('Reminder deleted');
            router.back();
          } catch {
            showError('Could not delete — try again');
            throw new Error('delete failed');
          }
        }}
      />
    </KeyboardAwareScreen>
  );
}
