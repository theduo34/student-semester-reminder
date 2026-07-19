import { ReactNode } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { withUniwind } from 'uniwind';

import { Screen, ScreenProps } from '@/components/ui/Screen';

const StyledKeyboardAwareScrollView = withUniwind(KeyboardAwareScrollView);

type KeyboardAwareScreenProps = Omit<ScreenProps, 'children'> & {
  children: ReactNode;
  contentContainerClassName?: string;
  bottomOffset?: number;
};

// The one keyboard-handling setup for every screen with text inputs — see CLAUDE.md.
// KeyboardAwareScrollView (react-native-keyboard-controller) over the bare
// KeyboardAvoidingView API, which Expo's own docs now steer people away from for being
// inconsistent on Android.
//
// Tap-outside-to-dismiss deliberately does NOT use a wrapping Pressable+
// Keyboard.dismiss() — that pattern is unreliable here: the Pressable sits as an
// ancestor of the ScrollView, and per RN's own keyboardShouldPersistTaps semantics, a
// tap "captured by an ancestor" suppresses the ScrollView's own auto-dismiss without
// reliably firing the ancestor's onPress in exchange (responder negotiation with a
// scrollable child is exactly what an ancestor Pressable was never a good fit for). The
// built-in behavior below already does this correctly with nothing to fight: `handled`
// dismisses the keyboard for any tap NOT claimed by an actual touchable child (labels,
// gaps between fields, background), while still letting real controls (buttons,
// selects) receive their first tap immediately instead of eating one tap to dismiss the
// keyboard first. `on-drag` covers moving focus by scrolling instead of tapping.
export function KeyboardAwareScreen({
  children,
  contentContainerClassName,
  bottomOffset = 24,
  ...screenProps
}: KeyboardAwareScreenProps) {
  return (
    <Screen {...screenProps}>
      <StyledKeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bottomOffset={bottomOffset}
        contentContainerClassName={['flex-grow', contentContainerClassName]
          .filter(Boolean)
          .join(' ')}>
        {children}
      </StyledKeyboardAwareScrollView>
    </Screen>
  );
}
