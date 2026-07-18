import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type SplashRevealProps = {
  onFinish: () => void;
};

// Plays once right after the native splash hides. A transition, not a loading gate —
// runs concurrently with the first real screen mounting underneath, capped under 800ms.
export function SplashReveal({ onFinish }: SplashRevealProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
    opacity.value = withSequence(
      withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 250 }),
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      }),
    );
  }, [onFinish, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      className="items-center justify-center bg-background">
      <AnimatedImage
        source={require('@/assets/images/mark.png')}
        style={[{ width: 96, height: 96 }, style]}
        contentFit="contain"
      />
    </Animated.View>
  );
}
