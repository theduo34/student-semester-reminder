import { Spinner, useThemeColor } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

export type ModalHeaderProps = {
  title: string;
  onClose: () => void;
  /** Omit entirely for a display-only modal with nothing to save (e.g. About) — the right slot stays an empty equal-width column so the title still centers correctly. */
  onSave?: () => void;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
  /** Labeled button (e.g. Edit's "Save"). Omit together with saveLabel for a circular icon-only action (e.g. Add's plus). */
  saveLabel?: string;
  /** Icon for the circular icon-only variant — ignored when saveLabel is set. Defaults to a plus (the "add" action). */
  saveIcon?: IconSymbolName;
};

// The X-left / bold-centered-title / Save-right header for every modal in the app (New
// Reminder, Edit Reminder, and whatever comes after) — see CLAUDE.md. Left and right
// slots are equal-width flex columns so the title (the wider middle column) is
// genuinely centered on the screen, not just centered in the leftover space between two
// differently-sized siblings. Owns the top safe-area inset itself, like AppTopBar, so
// Screen doesn't also pad for it. Kept compact (not a big generous headline block) — a
// modal header is a passing landmark, not a screen in its own right.
export function ModalHeader({
  title,
  onClose,
  onSave,
  isSaving,
  isSaveDisabled,
  saveLabel,
  saveIcon = 'plus',
}: ModalHeaderProps) {
  const insets = useSafeAreaInsets();
  const [foreground] = useCSSVariable(['--foreground']) as [string];
  const accentForeground = useThemeColor('accent-foreground');

  return (
    <View className="border-b border-border bg-surface" style={{ paddingTop: insets.top }}>
      <View
        className="flex-row items-center py-3"
        style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}>
        <View className="flex-1 items-start">
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <IconSymbol name="xmark" color={foreground} size={22} />
          </Pressable>
        </View>

        <View className="flex-[2] items-center">
          <Text numberOfLines={1} className="text-lg font-bold text-foreground">
            {title}
          </Text>
        </View>

        <View className="flex-1 items-end">
          {!onSave ? null : saveLabel ? (
            <Button
              onPress={onSave}
              isLoading={isSaving}
              isDisabled={isSaveDisabled}
              icon="checkmark"
              size="sm"
              fullWidth={false}>
              {saveLabel}
            </Button>
          ) : (
            <Pressable
              onPress={onSave}
              disabled={isSaveDisabled || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Save"
              className="size-9 items-center justify-center rounded-full bg-accent disabled:opacity-40">
              {isSaving ? (
                <Spinner color={accentForeground} />
              ) : (
                <IconSymbol name={saveIcon} color={accentForeground} size={20} />
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
