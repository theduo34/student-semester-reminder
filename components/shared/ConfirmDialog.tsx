import { Dialog } from 'heroui-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';

type ConfirmDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
};

// The standard confirmation for destructive actions app-wide (Log out here, Delete
// activity later) — native Alert.alert is deliberately not used, its OS-default look
// breaks the app's designed feel. Confirm is always styled danger; this component isn't
// meant for non-destructive confirmations. Dialog stays open with the confirm button's
// loading state while onConfirm's promise is in flight, and only closes on success —
// the caller decides how to surface a failure (toast), the dialog just re-enables itself.
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={isConfirming ? undefined : onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay isCloseOnPress={!isConfirming} />
        <Dialog.Content className="rounded-md">
          <View className="mb-5 gap-1.5">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{message}</Dialog.Description>
          </View>
          <View className="flex-row justify-end gap-3">
            <Button
              variant="secondary"
              fullWidth={false}
              isDisabled={isConfirming}
              onPress={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              fullWidth={false}
              isLoading={isConfirming}
              loadingLabel={confirmLabel}
              onPress={handleConfirm}>
              {confirmLabel}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
