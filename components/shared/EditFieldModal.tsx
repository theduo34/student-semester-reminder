import { Label, Select } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Modal, TextInputProps, View } from 'react-native';

import { ModalHeader } from '@/components/shared/ModalHeader';
import { TextField } from '@/components/ui/TextField';
import { SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';
import { useAppToast } from '@/hooks/use-app-toast';

export type EditFieldOption = { value: string; label: string };

type EditFieldModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** ModalHeader title, e.g. "Edit Name". */
  title: string;
  /** Field label shown above the input, e.g. "Full name". */
  label: string;
  value: string;
  /** Renders a Select instead of a TextField — Division's case (a fixed list, not free text). */
  options?: EditFieldOption[];
  /** Returns an error message, or null when valid. Ignored in select mode — a selected option is valid by construction. */
  validate?: (value: string) => string | null;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  textContentType?: TextInputProps['textContentType'];
  onSave: (value: string) => Promise<void>;
};

// The one single-field edit surface, reused for every editable row on the profile
// detail screen (name, phone, institutional email, division) and every admin
// Hierarchy Add/Edit flow — see CLAUDE.md. Same visual shape as the New/Edit Reminder
// modals (ModalHeader chrome), but presented via React Native's own Modal rather than
// an Expo Router route: this component is props-driven and rendered conditionally from
// wherever it's needed, not a fixed screen — a route per field would mean re-deriving
// label/value/validate/mutation from a param instead of just passing them in directly.
// `presentationStyle="fullScreen"`, not `"pageSheet"` — pageSheet already insets the
// sheet from the top on iOS, and ModalHeader separately pads for the safe-area inset
// itself (see that component), so the two together left a visible gap above the
// header instead of it sitting flush against the top like every other modal in this
// app (New/Edit Reminder, About, edit-academic-details).
export function EditFieldModal({
  isOpen,
  onClose,
  title,
  label,
  value,
  options,
  validate,
  keyboardType,
  autoCapitalize,
  textContentType,
  onSave,
}: EditFieldModalProps) {
  const { showError } = useAppToast();
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
    }
  }, [isOpen, value]);

  const errorMessage = !options && validate ? (validate(draft) ?? undefined) : undefined;
  const isChanged = draft !== value;
  const isValid = draft.trim().length > 0 && isChanged && !errorMessage;

  const handleSave = async () => {
    if (!isValid) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (error) {
      // Threads the server's actual message through (e.g. the institutional-email
      // domain check) rather than a generic one — same caveat as lib/authErrors.ts:
      // plain Error messages are redacted to "Server Error" on production Convex
      // deployments, so specific text only ever resolves in dev.
      showError(error instanceof Error ? error.message : 'Could not save — try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <ModalHeader
          title={title}
          onClose={onClose}
          onSave={handleSave}
          isSaving={isSaving}
          isSaveDisabled={!isValid}
          saveLabel="Save"
        />
        <View className="gap-4 pt-6" style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}>
          {options ? (
            <View className="gap-1.5">
              <Label>{label}</Label>
              <Select
                value={options.find((option) => option.value === draft)}
                onValueChange={(option) => option && setDraft(option.value)}>
                <Select.Trigger className="rounded-md">
                  <Select.Value placeholder={`Select ${label.toLowerCase()}`} />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover" width="trigger" className="rounded-md">
                    {options.map((option) => (
                      <Select.Item key={option.value} value={option.value} label={option.label} />
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>
          ) : (
            <TextField
              label={label}
              value={draft}
              onChangeText={setDraft}
              errorMessage={errorMessage}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              textContentType={textContentType}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
