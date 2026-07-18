import { ReactNode } from 'react';
import { Keyboard, Pressable } from 'react-native';
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
// inconsistent on Android. The outer Pressable dismisses the keyboard on any tap not
// otherwise claimed by an input/button — a plain press, so scroll drags cancel it
// automatically and it never fights the ScrollView's own gesture.
export function KeyboardAwareScreen({
  children,
  contentContainerClassName,
  bottomOffset = 24,
  ...screenProps
}: KeyboardAwareScreenProps) {
  return (
    <Screen {...screenProps}>
      <Pressable onPress={Keyboard.dismiss} className="flex-1" accessible={false}>
        <StyledKeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          bottomOffset={bottomOffset}
          contentContainerClassName={['flex-grow', contentContainerClassName]
            .filter(Boolean)
            .join(' ')}>
          {children}
        </StyledKeyboardAwareScrollView>
      </Pressable>
    </Screen>
  );
}
