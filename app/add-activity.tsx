import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ModalHeader } from '@/components/shared/ModalHeader';
import { isReminderFormValid, ReminderForm, ReminderFormValues } from '@/components/shared/ReminderForm';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { api } from '@/convex/_generated/api';
import { useAppToast } from '@/hooks/use-app-toast';

function defaultValues(): ReminderFormValues {
  const now = new Date();
  return {
    title: '',
    description: '',
    courseId: null,
    dueDate: now,
    startTime: now,
    endTime: null,
    priority: 'FLEXIBLE',
  };
}

// New Reminder modal (presentation: "modal"). Students only ever create personal
// reminders here — course activities are admin-published, never created from this app,
// so there's no tab switcher, just the one form. Headerless at the Stack level (see
// app/_layout.tsx) so ModalHeader owns both the top safe-area edge and the Close/Save
// actions.
export default function AddReminderScreen() {
  const router = useRouter();
  const { showSuccess, showError } = useAppToast();
  const semester = useQuery(api.semesters.getActive);
  const createReminder = useMutation(api.personalReminders.create);

  const [values, setValues] = useState<ReminderFormValues>(defaultValues);
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date();
  const isValid = isReminderFormValid(values, today) && semester !== undefined && semester !== null;

  const handleChange = (patch: Partial<ReminderFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    if (!isValid || semester === undefined || semester === null) {
      return;
    }
    setIsSaving(true);
    try {
      await createReminder({
        semesterId: semester._id,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        courseId: values.courseId ?? undefined,
        dueDate: values.dueDate.getTime(),
        startTime: values.startTime.getTime(),
        endTime: values.endTime?.getTime(),
        priority: values.priority,
      });
      showSuccess('Reminder added');
      router.back();
    } catch {
      showError('Could not add reminder — try again');
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
          title="New Reminder"
          onClose={() => router.back()}
          onSave={handleSave}
          isSaving={isSaving}
          isSaveDisabled={!isValid}
        />
      }
      contentContainerClassName="pb-8">
      {semester ? (
        <ReminderForm
          semesterId={semester._id}
          values={values}
          onChange={handleChange}
          minimumDueDate={today}
        />
      ) : null}
    </KeyboardAwareScreen>
  );
}
