import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

// Static text placeholder — not wired to a save action yet.
function SaveLink() {
  return <Text className="text-sm font-medium text-accent">Save</Text>;
}

// Modal, pre-filled from the entity being edited. Course is locked (not editable) —
// built feature by feature. Headerless (see app/_layout.tsx), so Screen owns both
// safe-area edges.
export default function EditActivityScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string }>();
  void entityId;

  return (
    <Screen bottomInset header={<AppTopBar left="close" title="Edit Activity" right={<SaveLink />} />} />
  );
}
