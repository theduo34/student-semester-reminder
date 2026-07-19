import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AcademicHierarchyForm,
  HierarchyField,
  HierarchyFormState,
  HierarchyValues,
  SESSION_LABELS,
} from '@/components/features/onboarding/AcademicHierarchyForm';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModalHeader } from '@/components/shared/ModalHeader';
import { SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { useAppToast } from '@/hooks/use-app-toast';

const FIELD_LABELS: Record<HierarchyField, string> = {
  faculty: 'Faculty',
  department: 'Department',
  program: 'Program',
  level: 'Level',
  session: 'Session',
};

const VALID_FIELDS: HierarchyField[] = ['faculty', 'department', 'program', 'level', 'session'];

// Modal (presentation: "modal"), not an RN Modal component — deliberately, since it
// nests a ConfirmDialog before saving. heroui's Dialog attaches to the app's own
// native window (FullWindowOverlay/react-native-screens), which a bare RN <Modal>
// (a separate native window) would render behind, not above — see the note this
// screen's sibling EditFieldModal doesn't need since it never nests a Dialog. Reached
// from the profile detail screen's ACADEMIC group; `startingFrom` (which field's
// pencil was tapped) is a route param since this is a real screen, not a
// component-rendered-inline like EditFieldModal.
export default function EditAcademicDetailsScreen() {
  const { startingFrom: startingFromParam } = useLocalSearchParams<{ startingFrom: string }>();
  const startingFrom = VALID_FIELDS.includes(startingFromParam as HierarchyField)
    ? (startingFromParam as HierarchyField)
    : 'faculty';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useAppToast();

  const profile = useQuery(api.studentProfiles.getMyProfile);
  const hierarchy = useQuery(
    api.academicStructure.getFullHierarchy,
    profile
      ? {
          facultyId: profile.facultyId,
          departmentId: profile.departmentId,
          academicClassId: profile.academicClassId,
          divisionId: profile.divisionId,
        }
      : 'skip',
  );
  const updateAcademicHierarchy = useMutation(api.studentProfiles.updateAcademicHierarchy);

  const [state, setState] = useState<HierarchyFormState>({ result: null, isValid: false });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const initialValues: HierarchyValues | undefined =
    profile && hierarchy
      ? {
          faculty: { value: profile.facultyId, label: hierarchy.facultyName },
          department: { value: profile.departmentId, label: hierarchy.departmentName },
          program: { value: profile.programId, label: hierarchy.programName },
          level: { value: String(hierarchy.level), label: `Level ${hierarchy.level}` },
          session: { value: hierarchy.session, label: SESSION_LABELS[hierarchy.session] },
          division:
            profile.divisionId && hierarchy.divisionLabel
              ? { value: profile.divisionId, label: hierarchy.divisionLabel }
              : undefined,
        }
      : undefined;

  const handleConfirm = async () => {
    if (!state.result) {
      return;
    }
    try {
      await updateAcademicHierarchy({
        facultyId: state.result.facultyId,
        departmentId: state.result.departmentId,
        programId: state.result.programId,
        academicClassId: state.result.academicClassId,
        divisionId: state.result.divisionId,
      });
      showSuccess('Academic details updated');
      router.back();
    } catch {
      showError('Could not update your academic details — try again');
      throw new Error('update failed');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ModalHeader
        title="Edit Academic Details"
        onClose={() => router.back()}
        onSave={() => setIsConfirmOpen(true)}
        isSaveDisabled={!state.isValid}
        saveLabel="Save"
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}>
        {initialValues ? (
          <AcademicHierarchyForm
            startingFrom={startingFrom}
            initialValues={initialValues}
            onStateChange={setState}
          />
        ) : null}
      </ScrollView>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Confirm academic details change"
        message={`Your dashboard and courses will update to match your new ${FIELD_LABELS[startingFrom]}. Any personal reminders linked to courses from your previous class will lose that link but still exist as standalone reminders.`}
        confirmLabel="Update details"
        onConfirm={handleConfirm}
      />
    </View>
  );
}
