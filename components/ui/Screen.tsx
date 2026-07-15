import { PropsWithChildren, ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Single source of truth for screen padding: 16px horizontal, matches the wireframes'
// `.content` padding. AppTopBar (components/shared/AppTopBar.tsx) imports this same
// constant for its own inner row, so a full-bleed header still lines up with the
// content below it. Change the number here, not per-screen or in AppTopBar.
export const SCREEN_HORIZONTAL_PADDING = 16;

// Single source of truth for header content height (below the safe-area inset), shared
// by every full-bleed header — AppTopBar and HomeHeader both import this so every
// screen's header is the same height, whatever it contains. Change it here only.
export const HEADER_CONTENT_HEIGHT = 56;

type ScreenProps = PropsWithChildren<{
  /**
   * Full-bleed header slot (typically AppTopBar). Renders edge-to-edge above the
   * padded content and owns the top safe-area inset itself (its background extends
   * behind the status bar, matching how the tab bar's background extends behind the
   * home indicator). When provided, Screen does NOT also pad for the top inset —
   * `topInset` is ignored in that case.
   */
  header?: ReactNode;
  /**
   * Pad for the top safe area (status bar / notch), for headerless screens (no
   * `header` slot). Ignored when `header` is provided — the header owns it instead.
   */
  topInset?: boolean;
  /**
   * Pad for the bottom safe area (home indicator). Tab screens don't need this — the
   * tab bar sits below them in normal flex flow and already reserves that space.
   * Headerless non-tab screens (e.g. modals) want true.
   */
  bottomInset?: boolean;
  /** Explicit override for a screen that genuinely needs different horizontal padding. */
  horizontalPadding?: number;
  style?: ViewStyle;
  className?: string;
}>;

export function Screen({
  children,
  header,
  topInset = true,
  bottomInset = false,
  horizontalPadding = SCREEN_HORIZONTAL_PADDING,
  style,
  className,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: !header && topInset ? insets.top : 0 }}>
      {header}
      <View
        className={['flex-1', className].filter(Boolean).join(' ')}
        style={[
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: bottomInset ? insets.bottom : 0,
          },
          style,
        ]}>
        {children}
      </View>
    </View>
  );
}
