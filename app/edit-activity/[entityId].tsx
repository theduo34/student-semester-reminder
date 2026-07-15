import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

// Modal, pre-filled from the entity being edited. Course is locked (not editable) —
// built feature by feature.
export default function EditActivityScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string }>();
  void entityId;

  return <View className="flex-1 bg-background" />;
}
