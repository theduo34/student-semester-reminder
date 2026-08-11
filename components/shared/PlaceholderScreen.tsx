import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

type PlaceholderScreenProps = {
  title: string;
  message: string;
  /** Passed straight through to AppTopBar's own `right` slot — a header action (e.g.
   * Publish's notifications bell) shouldn't have to wait on the tab's real content. */
  right?: ReactNode;
};

// A screen-shaped stand-in for a tab whose real content isn't built yet — same visual
// grammar as any other empty state in the app (Screen + AppTopBar + centered muted
// text), not a bare debug page. First used by the (admin) tab group's placeholder
// screens (see CLAUDE.md) — reach for this anywhere else a "not built yet" screen is
// needed instead of a one-off.
export function PlaceholderScreen({ title, message, right }: PlaceholderScreenProps) {
  return (
    <Screen header={<AppTopBar title={title} right={right} />}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-base text-muted">{message}</Text>
      </View>
    </Screen>
  );
}
