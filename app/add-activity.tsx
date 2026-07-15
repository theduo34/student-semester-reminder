import { Text } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

// Static text placeholder — not wired to a save action yet.
function SaveLink() {
  return <Text className="text-sm font-medium text-accent">Save</Text>;
}

// Modal (presentation: "modal"). Course activity / personal task tabs — built feature
// by feature. Headerless (see app/_layout.tsx), so Screen owns both safe-area edges.
export default function AddActivityScreen() {
  return (
    <Screen bottomInset header={<AppTopBar left="close" title="Add Activity" right={<SaveLink />} />} />
  );
}
