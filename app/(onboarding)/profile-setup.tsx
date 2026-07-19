import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { LinkButton } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  AcademicHierarchyForm,
  HierarchyFormState,
} from '@/components/features/onboarding/AcademicHierarchyForm';
import { AppTopBar } from '@/components/shared/AppTopBar';
import { Button } from '@/components/ui/Button';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/convex/_generated/api';
import { isValidEmail } from '@/lib/validation';

const STAGGER_STEP_MS = 50;

function stagger(index: number) {
  return FadeInDown.delay(index * STAGGER_STEP_MS).duration(300);
}

// Strictly select-from-list at every step — no free-text entry for any hierarchy
// field, since these are Admin-published and must resolve to a real academicClass. The
// cascade itself (AcademicHierarchyForm) is shared with the profile detail screen's
// academic-edit flow — this screen is just its "startingFrom omitted" caller, i.e.
// every field editable, nothing locked. A full stepped/wizard treatment (one picker per
// screen) felt like too much ceremony for six quick selections; the form's own progress
// bar plus per-step resolved checkmarks covers the same need with far less complexity.
export default function ProfileSetupScreen() {
  const { signOut } = useAuthActions();

  const [hierarchy, setHierarchy] = useState<HierarchyFormState>({ result: null, isValid: false });
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProfile = useMutation(api.studentProfiles.createProfile);

  const canSubmit =
    hierarchy.isValid &&
    isValidEmail(institutionalEmail) &&
    indexNumber.trim().length > 0 &&
    phoneNumber.trim().length > 0;

  const handleSubmit = async () => {
    if (!hierarchy.result) {
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);
    try {
      await createProfile({
        facultyId: hierarchy.result.facultyId,
        departmentId: hierarchy.result.departmentId,
        programId: hierarchy.result.programId,
        academicClassId: hierarchy.result.academicClassId,
        divisionId: hierarchy.result.divisionId,
        institutionalEmail,
        indexNumber: indexNumber.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      // Success — useAuthGate picks up the new profile and navigates away.
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setEmailError(
        message.toLowerCase().includes('email address')
          ? message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScreen
      header={<AppTopBar title="Profile Setup" />}
      contentContainerClassName="gap-8 pt-6 pb-6">
      <Animated.View entering={stagger(0)}>
        <AcademicHierarchyForm onStateChange={setHierarchy} />
      </Animated.View>

      <Animated.View entering={stagger(1)} className="gap-4">
        <Text className="text-base font-bold text-foreground">Contact details</Text>

        <TextField
          label="Institutional email"
          value={institutionalEmail}
          onChangeText={(text) => {
            setInstitutionalEmail(text);
            setEmailError(null);
          }}
          placeholder="you@ktu.edu.gh"
          icon="envelope"
          isRequired
          errorMessage={emailError ?? undefined}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <TextField
          label="Index number"
          value={indexNumber}
          onChangeText={setIndexNumber}
          placeholder="e.g. 2201234"
          isRequired
          autoCapitalize="characters"
        />

        <TextField
          label="Phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="e.g. 0241234567"
          isRequired
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
      </Animated.View>

      <Animated.View entering={stagger(2)} className="gap-4">
        <Button onPress={handleSubmit} isDisabled={!canSubmit} isLoading={isSubmitting}>
          Continue
        </Button>

        <View className="items-center">
          <LinkButton onPress={() => signOut()}>
            <LinkButton.Label className="text-muted">Log out</LinkButton.Label>
          </LinkButton>
        </View>
      </Animated.View>
    </KeyboardAwareScreen>
  );
}
