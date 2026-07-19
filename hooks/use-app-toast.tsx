import { Toast, useThemeColor, useToast } from 'heroui-native';
import { View } from 'react-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

type ToastKind = 'success' | 'error' | 'warning';

// heroui's own Toast keeps a neutral bg-surface background for every variant — only
// the label text tints per variant, which reads as barely distinguishable at a glance
// (see toast.styles.ts). Rendered via the "custom component" show() pattern instead, so
// each state gets a real tinted background + icon, not just a text-colour difference —
// same bg/icon-colour pairing convention as PriorityBadge and ActivityCard's icon well.
const KIND_CONFIG: Record<ToastKind, { variant: 'success' | 'danger' | 'warning'; icon: IconSymbolName; bg: string }> = {
  success: { variant: 'success', icon: 'checkmark.circle.fill', bg: 'bg-success/15' },
  error: { variant: 'danger', icon: 'exclamationmark.circle.fill', bg: 'bg-danger/15' },
  warning: { variant: 'warning', icon: 'exclamationmark.triangle.fill', bg: 'bg-warning/15' },
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

  const show = (kind: ToastKind, label: string) => {
    const config = KIND_CONFIG[kind];
    toast.show({
      component: (props) => (
        <Toast variant={config.variant} className={config.bg} {...props}>
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
