import { Button as HeroButton, Spinner, useThemeColor } from 'heroui-native';

type ButtonProps = {
  onPress: () => void;
  children: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  /** Shown in place of `children` while `isLoading` — e.g. "Log in" -> "Logging in…". */
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-soft';
  className?: string;
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
  className,
}: ButtonProps) {
  const accentForeground = useThemeColor('accent-foreground');

  return (
    <HeroButton
      variant={variant}
      isDisabled={isDisabled || isLoading}
      onPress={onPress}
      className={['w-full', className].filter(Boolean).join(' ')}>
      {isLoading ? (
        <>
          <Spinner color={accentForeground} />
          <HeroButton.Label>{loadingLabel ?? children}</HeroButton.Label>
        </>
      ) : (
        <HeroButton.Label>{children}</HeroButton.Label>
      )}
    </HeroButton>
  );
}
