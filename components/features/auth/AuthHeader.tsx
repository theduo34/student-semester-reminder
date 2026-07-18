import { Image } from 'expo-image';
import { View } from 'react-native';

/**
 * Centered, standalone header for the Login/Register screen only — a third header
 * shape distinct from AppTopBar and HomeHeader (components/shared/AppTopBar.tsx,
 * components/features/dashboard/HomeHeader.tsx). No back/close/action slots, and no
 * edge-to-edge bg-surface bar, so it's rendered as regular content inside Screen (not
 * passed as Screen's `header` slot) — Screen's default top safe-area padding applies.
 * Uses the full lockup (icon + wordmark + tagline) — the icon alone already has its
 * rounded-square treatment baked into the source asset, no clipping/border-radius
 * needed here.
 */
export function AuthHeader() {
  return (
    <View className="items-center pb-8 pt-4">
      <Image
        source={require('@/assets/images/lockup.png')}
        style={{ width: 190, height: 56 }}
        contentFit="contain"
      />
    </View>
  );
}
