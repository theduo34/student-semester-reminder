import { Toast, useThemeColor, useToast } from 'heroui-native';
import { View } from 'react-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

type ToastKind = 'success' | 'error' | 'warning';

// heroui's own Toast keeps a neutral bg-surface background for every variant — only
// the label text tints per variant, which reads as barely distinguishable at a glance
// (see toast.styles.ts). Rendered via the "custom component" show() pattern instead, so
// each state gets a real tinted background + icon, not just a text-colour difference —
// same bg/icon-colour pairing convention as PriorityBadge and ActivityCard's icon well.
//
// The background is applied via an inline `style`, not `className` — passing a
// `bg-*` className here has to survive heroui's own internal tv()/tailwind-merge pass
// against its base `bg-surface` class, and in practice loses (root stayed bg-surface,
// nearly transparent-looking against the icon/text colour). Same fix as Calendar's
// selected-day tint (see CLAUDE.md): resolve the colour via useThemeColor and set it
// as an inline style, which always wins. Uses heroui's own paired "-soft"/"-soft-
// foreground" tokens (same ones Toast.Title's variant styling already reads) rather
// than a separate bg-{color}/15 opacity modifier, so the background and text colours
// are a matched, accessible pair instead of two independently-chosen tints.
const KIND_CONFIG: Record<ToastKind, { variant: 'success' | 'danger' | 'warning'; icon: IconSymbolName }> = {
  success: { variant: 'success', icon: 'checkmark.circle.fill' },
  error: { variant: 'danger', icon: 'exclamationmark.circle.fill' },
  warning: { variant: 'warning', icon: 'exclamationmark.triangle.fill' },
};

// Thin convenience layer over heroui-native's own Toast (ToastProvider already comes
// from HeroUINativeProvider in app/_layout.tsx — no separate provider needed). Maps
// this app's success/error/warning vocabulary onto heroui's variant names, so call
// sites don't each have to remember that "error" means the "danger" variant.
export function useAppToast() {
  const { toast } = useToast();
  const successColor = useThemeColor('success');
  const dangerColor = useThemeColor('danger');
  const warningColor = useThemeColor('warning');
  const iconColor: Record<ToastKind, string> = { success: successColor, error: dangerColor, warning: warningColor };

  const successBg = useThemeColor('success-soft');
  const dangerBg = useThemeColor('danger-soft');
  const warningBg = useThemeColor('warning-soft');
  const bgColor: Record<ToastKind, string> = { success: successBg, error: dangerBg, warning: warningBg };

  const show = (kind: ToastKind, label: string) => {
    const config = KIND_CONFIG[kind];
    toast.show({
      component: (props) => (
        <Toast variant={config.variant} style={{ backgroundColor: bgColor[kind] }} {...props}>
          <View className="flex-row items-center gap-2">
            <IconSymbol name={config.icon} size={18} color={iconColor[kind]} />
            <Toast.Title className="flex-1">{label}</Toast.Title>
          </View>
        </Toast>
      ),
    });
  };

  return {
    showSuccess: (label: string) => show('success', label),
    showError: (label: string) => show('error', label),
    showWarning: (label: string) => show('warning', label),
  };
}
