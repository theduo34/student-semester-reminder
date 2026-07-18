import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { LinkButton } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HierarchyPicker, PickerOption } from '@/components/features/onboarding/HierarchyPicker';
import { AppTopBar } from '@/components/shared/AppTopBar';
import { Button } from '@/components/ui/Button';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { isValidEmail } from '@/lib/validation';

type SessionValue = 'REGULAR' | 'WEEKEND';

const SESSION_LABELS: Record<SessionValue, string> = {
  REGULAR: 'Regular',
  WEEKEND: 'Weekend',
};

const STAGGER_STEP_MS = 50;

function stagger(index: number) {
  return FadeInDown.delay(index * STAGGER_STEP_MS).duration(300);
}

// Strictly select-from-list at every step — no free-text entry for any hierarchy
// field, since these are Admin-published and must resolve to a real academicClass.
// The picker cascade is grouped under its own "Academic details" section with a
// progress bar (how many of the applicable steps are resolved) so six dropdowns read
// as guided progression rather than one long flat form — see CLAUDE.md's spacing
// convention. A full stepped/wizard treatment (one picker per screen) felt like too
// much ceremony for six quick selections; the progress bar plus per-step resolved
// checkmarks (HierarchyPicker) covers the same need with far less complexity.
export default function ProfileSetupScreen() {
  const { signOut } = useAuthActions();

  const [faculty, setFaculty] = useState<PickerOption>();
  const [department, setDepartment] = useState<PickerOption>();
  const [program, setProgram] = useState<PickerOption>();
  const [level, setLevel] = useState<PickerOption>();
  const [session, setSession] = useState<PickerOption>();
  const [division, setDivision] = useState<PickerOption>();

  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const facultyId = faculty?.value as Id<'faculties'> | undefined;
  const departmentId = department?.value as Id<'departments'> | undefined;
  const programId = program?.value as Id<'programs'> | undefined;
  const levelNumber = level ? Number(level.value) : undefined;
  const sessionValue = session?.value as SessionValue | undefined;

  const faculties = useQuery(api.academicStructure.listFaculties, {});
  const departments = useQuery(
    api.academicStructure.listDepartmentsByFaculty,
    facultyId ? { facultyId } : 'skip',
  );
  const programs = useQuery(
    api.academicStructure.listProgramsByDepartment,
    departmentId ? { departmentId } : 'skip',
  );
  const levels = useQuery(
    api.academicStructure.listLevelsByProgram,
    programId ? { programId } : 'skip',
  );
  const sessions = useQuery(
    api.academicStructure.listSessionsByProgramAndLevel,
    programId && levelNumber !== undefined ? { programId, level: levelNumber } : 'skip',
  );
  const resolvedClass = useQuery(
    api.academicStructure.getClassByProgramLevelSession,
    programId && levelNumber !== undefined && sessionValue
      ? { programId, level: levelNumber, session: sessionValue }
      : 'skip',
  );
  const divisions = useQuery(
    api.academicStructure.listDivisionsByClass,
    resolvedClass ? { academicClassId: resolvedClass._id } : 'skip',
  );

  const createProfile = useMutation(api.studentProfiles.createProfile);

  const facultyOptions: PickerOption[] = (faculties ?? []).map((row) => ({
    value: row._id,
    label: row.name,
  }));
  const departmentOptions: PickerOption[] = (departments ?? []).map((row) => ({
    value: row._id,
    label: row.name,
  }));
  const programOptions: PickerOption[] = (programs ?? []).map((row) => ({
    value: row._id,
    label: row.name,
  }));
  const levelOptions: PickerOption[] = (levels ?? []).map((value) => ({
    value: String(value),
    label: `Level ${value}`,
  }));
  const sessionOptions: PickerOption[] = (sessions ?? []).map((value) => ({
    value,
    label: SESSION_LABELS[value],
  }));
  const divisionOptions: PickerOption[] = (divisions ?? []).map((row) => ({
    value: row._id,
    label: row.label,
  }));
  const hasDivisions = (divisions?.length ?? 0) > 0;

  const pickerValues = hasDivisions
    ? [faculty, department, program, level, session, division]
    : [faculty, department, program, level, session];
  const resolvedStepCount = pickerValues.filter(Boolean).length;
  const progressPercent = Math.round((resolvedStepCount / pickerValues.length) * 100);

  const canSubmit =
    Boolean(resolvedClass) &&
    (!hasDivisions || Boolean(division)) &&
    isValidEmail(institutionalEmail) &&
    indexNumber.trim().length > 0 &&
    phoneNumber.trim().length > 0;

  const handleSubmit = async () => {
    if (!resolvedClass || !facultyId || !departmentId || !programId) {
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);
    try {
      await createProfile({
        facultyId,
        departmentId,
        programId,
        academicClassId: resolvedClass._id,
        divisionId: division ? (division.value as Id<'divisions'>) : undefined,
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
      <Animated.View entering={stagger(0)} className="gap-3">
        <View className="gap-1.5">
          <Text className="text-base font-bold text-foreground">Academic details</Text>
          <View className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
            <View className="h-1.5 rounded-full bg-accent" style={{ width: `${progressPercent}%` }} />
          </View>
        </View>

        <View className="gap-4">
          <HierarchyPicker
            label="Faculty"
            placeholder="Select faculty"
            options={facultyOptions}
            value={faculty}
            onValueChange={(option) => {
              setFaculty(option);
              setDepartment(undefined);
              setProgram(undefined);
              setLevel(undefined);
              setSession(undefined);
              setDivision(undefined);
            }}
          />

          <HierarchyPicker
            label="Department"
            placeholder="Select department"
            options={departmentOptions}
            value={department}
            isDisabled={!facultyId}
            onValueChange={(option) => {
              setDepartment(option);
              setProgram(undefined);
              setLevel(undefined);
              setSession(undefined);
              setDivision(undefined);
            }}
          />

          <HierarchyPicker
            label="Program"
            placeholder="Select program"
            options={programOptions}
            value={program}
            isDisabled={!departmentId}
            onValueChange={(option) => {
              setProgram(option);
              setLevel(undefined);
              setSession(undefined);
              setDivision(undefined);
            }}
          />

          <HierarchyPicker
            label="Level"
            placeholder="Select level"
            options={levelOptions}
            value={level}
            isDisabled={!programId}
            onValueChange={(option) => {
              setLevel(option);
              setSession(undefined);
              setDivision(undefined);
            }}
          />

          <HierarchyPicker
            label="Session"
            placeholder="Select session"
            options={sessionOptions}
            value={session}
            isDisabled={levelNumber === undefined}
            onValueChange={(option) => {
              setSession(option);
              setDivision(undefined);
            }}
          />

          {hasDivisions ? (
            <HierarchyPicker
              label="Division"
              placeholder="Select division"
              options={divisionOptions}
              value={division}
              onValueChange={setDivision}
            />
          ) : null}
        </View>
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
