import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ListGroup, Separator, Skeleton, useThemeColor } from 'heroui-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SESSION_LABELS } from '@/components/features/onboarding/AcademicHierarchyForm';
import { Avatar } from '@/components/shared/Avatar';
import { EditFieldModal, EditFieldOption } from '@/components/shared/EditFieldModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { isValidEmail, isValidPhoneNumber } from '@/lib/validation';

type EditableField = 'name' | 'phone' | 'institutionalEmail' | 'division';
type HierarchyEditField = 'faculty' | 'department' | 'program' | 'level' | 'session';

// WhatsApp-style detail screen: a glance tells you what's editable (a pencil icon) and
// what isn't (no icon at all — not a disabled one) without tapping first. Faculty
// through Session route to the shared cascading picker (app/edit-academic-details.tsx)
// since changing any of them can cascade into the ones below; Division and
// institutional email are single-field, so they use EditFieldModal directly. Native
// header (title "Profile") comes from app/(protected)/_layout.tsx — see CLAUDE.md's
// nested-navigation pattern, no AppTopBar/Screen here.
export default function ProfileDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const muted = useThemeColor('muted');

  const viewer = useQuery(api.users.viewer);
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
  const divisions = useQuery(
    api.academicStructure.listDivisionsByClass,
    profile ? { academicClassId: profile.academicClassId } : 'skip',
  );

  const updateName = useMutation(api.users.updateName);
  const updatePhoneNumber = useMutation(api.studentProfiles.updatePhoneNumber);
  const updateInstitutionalEmail = useMutation(api.studentProfiles.updateInstitutionalEmail);
  const updateDivision = useMutation(api.studentProfiles.updateDivision);

  const [activeField, setActiveField] = useState<EditableField | null>(null);

  const isLoading =
    viewer === undefined || profile === undefined || hierarchy === undefined || divisions === undefined;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <ProfileDetailSkeleton />
      </View>
    );
  }
  if (!viewer || !profile || !hierarchy) {
    return null;
  }

  const joinedDate = new Date(viewer._creationTime).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const hasDivisions = (divisions?.length ?? 0) > 0;
  const divisionOptions: EditFieldOption[] = divisions.map((division) => ({
    value: division._id,
    label: division.label,
  }));

  const editField = (() => {
    switch (activeField) {
      case 'name':
        return {
          title: 'Edit Name',
          label: 'Full name',
          value: viewer.name ?? '',
          validate: (value: string) => (value.trim().length === 0 ? 'Name cannot be empty' : null),
          onSave: async (value: string) => {
            await updateName({ name: value });
          },
        };
      case 'phone':
        return {
          title: 'Edit Phone Number',
          label: 'Phone number',
          value: profile.phoneNumber,
          validate: (value: string) => (isValidPhoneNumber(value) ? null : 'Enter a valid phone number'),
          keyboardType: 'phone-pad' as const,
          onSave: async (value: string) => {
            await updatePhoneNumber({ phoneNumber: value });
          },
        };
      case 'institutionalEmail':
        return {
          title: 'Edit Institutional Email',
          label: 'Institutional email',
          value: profile.institutionalEmail,
          validate: (value: string) => (isValidEmail(value) ? null : 'Enter a valid email address'),
          keyboardType: 'email-address' as const,
          autoCapitalize: 'none' as const,
          onSave: async (value: string) => {
            await updateInstitutionalEmail({ institutionalEmail: value });
          },
        };
      case 'division':
        return {
          title: 'Edit Division',
          label: 'Division',
          value: profile.divisionId ?? '',
          options: divisionOptions,
          onSave: async (value: string) => {
            await updateDivision({ divisionId: value as Id<'divisions'> });
          },
        };
      default:
        return null;
    }
  })();

  const editHierarchyField = (field: HierarchyEditField) => {
    router.push({ pathname: '/edit-academic-details', params: { startingFrom: field } });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-8 px-4 pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="items-center gap-2">
          <Avatar name={viewer.name ?? ''} size="lg" />
          <Text className="text-xl font-bold text-foreground">{viewer.name ?? 'Student'}</Text>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="calendar" size={14} color={muted} />
            <Text className="text-sm text-muted">Joined {joinedDate}</Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="ml-2 text-xs font-semibold uppercase text-muted">Account</Text>
          <ListGroup className="rounded-md">
            <DetailRow label="Full name" value={viewer.name ?? '—'} onEdit={() => setActiveField('name')} />
            <Separator className="mx-4" />
            <DetailRow label="Email" value={viewer.email ?? '—'} />
            <Separator className="mx-4" />
            <DetailRow
              label="Phone number"
              value={profile.phoneNumber}
              onEdit={() => setActiveField('phone')}
            />
          </ListGroup>
        </View>

        <View className="gap-2">
          <Text className="ml-2 text-xs font-semibold uppercase text-muted">Academic</Text>
          <ListGroup className="rounded-md">
            <DetailRow
              label="Institutional email"
              value={profile.institutionalEmail}
              onEdit={() => setActiveField('institutionalEmail')}
            />
            <Separator className="mx-4" />
            <DetailRow
              label="Index number"
              value={profile.indexNumber}
              caption="Contact your academic admin to correct this."
            />
            <Separator className="mx-4" />
            <DetailRow
              label="Faculty"
              value={hierarchy.facultyName}
              onEdit={() => editHierarchyField('faculty')}
            />
            <Separator className="mx-4" />
            <DetailRow
              label="Department"
              value={hierarchy.departmentName}
              onEdit={() => editHierarchyField('department')}
            />
            <Separator className="mx-4" />
            <DetailRow
              label="Program"
              value={hierarchy.programName}
              onEdit={() => editHierarchyField('program')}
            />
            <Separator className="mx-4" />
            <DetailRow
              label="Level"
              value={`Level ${hierarchy.level}`}
              onEdit={() => editHierarchyField('level')}
            />
            <Separator className="mx-4" />
            <DetailRow
              label="Session"
              value={SESSION_LABELS[hierarchy.session]}
              onEdit={() => editHierarchyField('session')}
            />
            {hasDivisions && hierarchy.divisionLabel ? (
              <>
                <Separator className="mx-4" />
                <DetailRow
                  label="Division"
                  value={hierarchy.divisionLabel}
                  onEdit={() => setActiveField('division')}
                />
              </>
            ) : null}
          </ListGroup>
        </View>
      </ScrollView>

      {editField ? (
        <EditFieldModal
          isOpen={activeField !== null}
          onClose={() => setActiveField(null)}
          title={editField.title}
          label={editField.label}
          value={editField.value}
          options={'options' in editField ? editField.options : undefined}
          validate={'validate' in editField ? editField.validate : undefined}
          keyboardType={'keyboardType' in editField ? editField.keyboardType : undefined}
          autoCapitalize={'autoCapitalize' in editField ? editField.autoCapitalize : undefined}
          onSave={editField.onSave}
        />
      ) : null}
    </View>
  );
}

function DetailRow({
  label,
  value,
  caption,
  onEdit,
}: {
  label: string;
  value: string;
  caption?: string;
  onEdit?: () => void;
}) {
  const muted = useThemeColor('muted');

  return (
    <ListGroup.Item onPress={onEdit} disabled={!onEdit}>
      <ListGroup.ItemContent>
        <ListGroup.ItemDescription>{label}</ListGroup.ItemDescription>
        <ListGroup.ItemTitle>{value}</ListGroup.ItemTitle>
        {caption ? <Text className="mt-1 text-xs text-muted">{caption}</Text> : null}
      </ListGroup.ItemContent>
      {onEdit ? (
        <ListGroup.ItemSuffix>
          <IconSymbol name="pencil" size={18} color={muted} />
        </ListGroup.ItemSuffix>
      ) : null}
    </ListGroup.Item>
  );
}

function ProfileDetailSkeleton() {
  return (
    <View className="gap-8">
      <View className="items-center gap-2">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </View>
      <Skeleton className="h-36 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-md" />
    </View>
  );
}
