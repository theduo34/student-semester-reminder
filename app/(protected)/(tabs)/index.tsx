import { Text, View } from 'react-native';

// Home dashboard: progress bar, empty state, today/upcoming/overdue sections — built
// feature by feature.
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground">Home</Text>
    </View>
  );
}
