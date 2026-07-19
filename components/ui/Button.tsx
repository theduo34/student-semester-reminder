import { Button as HeroButton, Spinner, ThemeColor, useThemeColor } from 'heroui-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-soft';

type ButtonProps = {
  onPress: () => void;
  children: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  /** Shown in place of `children` while `isLoading` — e.g. "Log in" -> "Logging in…". */
  loadingLabel?: string;
  variant?: ButtonVariant;
  /** Full-width is the default (every form CTA); set false for compact inline use like ConfirmDialog's paired actions. */
  fullWidth?: boolean;
  /** Leading icon — e.g. the checkmark on ModalHeader's Save action. Hidden while isLoading (the spinner takes its place). */
  icon?: IconSymbolName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

// Icon (and spinner) color per variant — mirrors heroui's own Button.Label color per
// variant (see button.styles.ts) since IconSymbol needs an explicit resolved color,
// unlike Label which themes itself.
const VARIANT_ICON_COLOR: Record<ButtonVariant, ThemeColor> = {
  primary: 'accent-foreground',
  secondary: 'accent-soft-foreground',
  danger: 'danger-foreground',
  'danger-soft': 'danger-soft-foreground',
};

// The one submit button across all five auth screens — see CLAUDE.md. Defaults to
// full width since every current use is a form's primary action. Loading state keeps
// the button's normal (non-icon-only) shape and swaps content in place — the earlier
// per-screen pattern used `isIconOnly` to show just a spinner, which collapsed the
// button to a square and was the actual cause of the loading-button "jump" bug.
export function Button({
  onPress,
  children,
  isDisabled,
  isLoading,
  loadingLabel,
  variant = 'primary',
  fullWidth = true,
  icon,
  size,
  className,
}: ButtonProps) {
  const iconColor = useThemeColor(VARIANT_ICON_COLOR[variant]);

  return (
    <HeroButton
      variant={variant}
      size={size}
      isDisabled={isDisabled || isLoading}
      onPress={onPress}
      className={[fullWidth && 'w-full', className].filter(Boolean).join(' ')}>
      {isLoading ? (
        <>
          <Spinner color={iconColor} />
          <HeroButton.Label>{loadingLabel ?? children}</HeroButton.Label>
        </>
      ) : (
        <>
          {icon ? <IconSymbol name={icon} size={16} color={iconColor} /> : null}
          <HeroButton.Label>{children}</HeroButton.Label>
        </>
      )}
    </HeroButton>
  );
}
