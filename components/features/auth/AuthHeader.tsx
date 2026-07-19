import { Image } from 'expo-image';
import { View } from 'react-native';

const FAVICON_SIZE = 132;
// Larger than the standard --radius-md content-card rounding (see CLAUDE.md's Radius
// convention) — deliberately bigger here, closer to a real app-icon's corner ratio,
// per feedback. Set via style rather than a `rounded-*` className since it doesn't
// match one of Tailwind's fixed steps.
const FAVICON_RADIUS = 24;

/**
 * Centered, standalone header for the Login/Register screen only — a third header
 * shape distinct from AppTopBar and HomeHeader (components/shared/AppTopBar.tsx,
 * components/features/dashboard/HomeHeader.tsx). No back/close/action slots, and no
 * edge-to-edge bg-surface bar, so it's rendered as regular content inside Screen (not
 * passed as Screen's `header` slot) — Screen's default top safe-area padding applies.
 *
 * Just `favicon.png` directly — it already bakes in the navy square background and the
 * white/orange mark, so no separately-built background box or tint here (an earlier
 * version of this component did that and it was reverted per feedback).
 */
export function AuthHeader() {
  return (
    <View className="items-center pb-8 pt-4">
      <Image
        source={require('@/assets/images/favicon.png')}
        style={{ width: FAVICON_SIZE, height: FAVICON_SIZE, borderRadius: FAVICON_RADIUS }}
        contentFit="cover"
      />
    </View>
  );
}
