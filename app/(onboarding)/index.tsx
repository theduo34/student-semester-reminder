import { useAuthActions } from '@convex-dev/auth/react';
import { Image } from 'expo-image';
import { LinkButton, useThemeColor } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';

const BADGE_OUTER = 180;
const BADGE_INNER = 132;

// A slow breathing halo around the mark — the one visual cue on this screen that it's
// actively listening for the semester to go active, not a static "come back later"
// dead end. Same badge geometry as the landing carousel's slides (outer low-opacity
// ring + accentSoft-filled circle), just animated here since this screen can sit open
// for a while, unlike a carousel slide you swipe past in a second.
function WaitingBadge({ accent, accentSoft }: { accent: string; accentSoft: string }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.1 - pulse.value * 0.05,
  }));

  return (
    <View className="items-center justify-center" style={{ width: BADGE_OUTER, height: BADGE_OUTER }}>
      <Animated.View
        className="absolute rounded-full"
        style={[{ width: BADGE_OUTER, height: BADGE_OUTER, backgroundColor: accent }, ringStyle]}
      />
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: BADGE_INNER,
          height: BADGE_INNER,
          backgroundColor: accentSoft,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 6,
        }}>
        <Image source={require('@/assets/images/mark.png')} style={{ width: 72, height: 72 }} contentFit="contain" />
      </View>
    </View>
  );
}

// Shown when authenticated + verified but no semester is published yet. The
// api.semesters.getActive subscription (in the root layout's auth gate) is what
// actually navigates away the instant a semester goes active — this screen never
// needs to poll. "Check now" only exists to reassure the student that we're still
// watching; there is nothing for it to actually (re)fetch.
export default function OnboardingScreen() {
  const { signOut } = useAuthActions();
  const accent = useThemeColor('accent');
  const accentSoft = useThemeColor('accent-soft');
  const successColor = useThemeColor('success');
  const [showReassurance, setShowReassurance] = useState(false);
  const reassuranceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheckNow = () => {
    setShowReassurance(true);
    if (reassuranceTimeout.current) {
      clearTimeout(reassuranceTimeout.current);
    }
    reassuranceTimeout.current = setTimeout(() => setShowReassurance(false), 3000);
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <WaitingBadge accent={accent} accentSoft={accentSoft} />

        <View className="gap-3">
          <Text className="text-center text-xl font-bold text-foreground">
            Waiting on your semester
          </Text>
          <Text className="text-center text-sm leading-5 text-muted">
            Your academic admin hasn&apos;t published a semester yet. You&apos;ll be taken
            straight in the moment they do — no need to keep this screen open.
          </Text>
        </View>

        <View className="items-center gap-3">
          <Button variant="secondary" fullWidth={false} className="px-6" onPress={handleCheckNow}>
            Check now
          </Button>
          {showReassurance ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="flex-row items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5">
              <IconSymbol name="checkmark.circle.fill" size={14} color={successColor} />
              <Text className="text-xs font-medium text-success">Still watching — nothing published yet</Text>
            </Animated.View>
          ) : null}
        </View>

        <LinkButton className="mt-2" onPress={() => signOut()}>
          <LinkButton.Label className="text-muted">Log out</LinkButton.Label>
        </LinkButton>
      </View>
    </Screen>
  );
}
