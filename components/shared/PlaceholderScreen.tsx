import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

type PlaceholderScreenProps = {
  title: string;
  message: string;
};

// A screen-shaped stand-in for a tab whose real content isn't built yet — same visual
// grammar as any other empty state in the app (Screen + AppTopBar + centered muted
// text), not a bare debug page. First used by the (admin) tab group's four placeholder
// screens (see CLAUDE.md) — reach for this anywhere else a "not built yet" screen is
// needed instead of a one-off.
export function PlaceholderScreen({ title, message }: PlaceholderScreenProps) {
  return (
    <Screen header={<AppTopBar title={title} />}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-base text-muted">{message}</Text>
      </View>
    </Screen>
  );
}
