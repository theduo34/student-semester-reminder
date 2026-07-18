import { useToast } from 'heroui-native';

// Thin convenience layer over heroui-native's own Toast (ToastProvider already comes
// from HeroUINativeProvider in app/_layout.tsx — no separate provider needed). Maps
// this app's success/error/warning vocabulary onto heroui's variant names and the
// existing --success/--danger/--warning tokens from global.css, so call sites don't
// each have to remember that "error" means the "danger" variant.
export function useAppToast() {
  const { toast } = useToast();

  return {
    showSuccess: (label: string) => toast.show({ variant: 'success', label }),
    showError: (label: string) => toast.show({ variant: 'danger', label }),
    showWarning: (label: string) => toast.show({ variant: 'warning', label }),
  };
}
