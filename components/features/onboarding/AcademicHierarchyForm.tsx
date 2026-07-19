import { useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { HierarchyPicker, PickerOption } from '@/components/features/onboarding/HierarchyPicker';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export type SessionValue = 'REGULAR' | 'WEEKEND';

export const SESSION_LABELS: Record<SessionValue, string> = {
  REGULAR: 'Regular',
  WEEKEND: 'Weekend',
};

export type HierarchyField = 'faculty' | 'department' | 'program' | 'level' | 'session';
const FIELD_ORDER: HierarchyField[] = ['faculty', 'department', 'program', 'level', 'session'];

export type HierarchyValues = {
  faculty?: PickerOption;
  department?: PickerOption;
  program?: PickerOption;
  level?: PickerOption;
  session?: PickerOption;
  division?: PickerOption;
};

export type HierarchyResult = {
  facultyId: Id<'faculties'>;
  departmentId: Id<'departments'>;
  programId: Id<'programs'>;
  academicClassId: Id<'academicClasses'>;
  divisionId?: Id<'divisions'>;
  programName: string;
};

export type HierarchyFormState = { result: HierarchyResult | null; isValid: boolean };

type AcademicHierarchyFormProps = {
  /** Pre-fills every step — required for an edit flow, omitted for a fresh Profile Setup. */
  initialValues?: HierarchyValues;
  /** Fields before this stay locked (shown, disabled, fixed to initialValues); this field and everything below are live. Default 'faculty' — everything editable, Profile Setup's case. */
  startingFrom?: HierarchyField;
  /** Fires on every change with the resolved chain once valid, or null while incomplete — the caller owns its own submit button and reads the latest state from here rather than this form rendering one itself. */
  onStateChange: (state: HierarchyFormState) => void;
};

// The Faculty -> Department -> Program -> Level -> Session -> Division cascade, shared
// by Profile Setup (startingFrom omitted — everything editable) and the profile detail
// screen's academic-edit flow (startingFrom = whichever field's pencil was tapped). A
// locked field is still shown (never hidden) — the correction: rendered as the same
// HierarchyPicker, just disabled and fixed to its initial value, not swapped for a
// separate read-only row. "Sticky" pre-selection of previous values below the tapped
// field is not special-cased logic — it falls out for free from simply *seeding* state
// from initialValues instead of starting blank; the existing clear-everything-below
// behavior on an actual onValueChange still applies unchanged.
export function AcademicHierarchyForm({
  initialValues,
  startingFrom = 'faculty',
  onStateChange,
}: AcademicHierarchyFormProps) {
  const startingIndex = FIELD_ORDER.indexOf(startingFrom);
  const isLocked = (field: HierarchyField) => FIELD_ORDER.indexOf(field) < startingIndex;

  const [faculty, setFaculty] = useState<PickerOption | undefined>(initialValues?.faculty);
  const [department, setDepartment] = useState<PickerOption | undefined>(initialValues?.department);
  const [program, setProgram] = useState<PickerOption | undefined>(initialValues?.program);
  const [level, setLevel] = useState<PickerOption | undefined>(initialValues?.level);
  const [session, setSession] = useState<PickerOption | undefined>(initialValues?.session);
  const [division, setDivision] = useState<PickerOption | undefined>(initialValues?.division);

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

  const isValid = Boolean(resolvedClass) && (!hasDivisions || Boolean(division));

  useEffect(() => {
    if (isValid && resolvedClass && facultyId && departmentId && programId) {
      onStateChange({
        isValid: true,
        result: {
          facultyId,
          departmentId,
          programId,
          academicClassId: resolvedClass._id,
          divisionId: division ? (division.value as Id<'divisions'>) : undefined,
          programName: program?.label ?? '',
        },
      });
    } else {
      onStateChange({ isValid: false, result: null });
    }
    // onStateChange intentionally omitted — callers pass an inline closure each render;
    // depending on it would re-fire this effect every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, resolvedClass, facultyId, departmentId, programId, division, program?.label]);

  return (
    <View className="gap-3">
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
          isDisabled={isLocked('faculty')}
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
          isDisabled={isLocked('department') || !facultyId}
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
          isDisabled={isLocked('program') || !departmentId}
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
          isDisabled={isLocked('level') || !programId}
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
          isDisabled={isLocked('session') || levelNumber === undefined}
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
    </View>
  );
}
