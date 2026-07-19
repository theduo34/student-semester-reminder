import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Dialog, Label } from 'heroui-native';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';

type DateTimeFieldProps = {
  label: string;
  mode: 'date' | 'time';
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
};

// TextField-styled wrapper around the native date/time picker (@react-native-community/
// datetimepicker) — shared by every date/time input in the app so the picker itself is
// never hand-rolled and every field looks like the rest of the form. Android's picker is
// natively modal (rendering it conditionally is enough); iOS has no equivalent
// tap-to-popup for a plain spinner, so it's presented inside the app's own Dialog with a
// Done button instead.
export function DateTimeField({ label, mode, value, onChange, minimumDate }: DateTimeFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [muted] = useCSSVariable(['--muted']) as [string];

  const formatted =
    mode === 'date'
      ? value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      : value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setIsOpen(false);
    if (event.type === 'set' && selected) {
      onChange(selected);
    }
  };

  return (
    <View className="gap-1.5">
      <Label>{label}</Label>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="w-full flex-row items-center justify-between rounded-md border border-field-border bg-field px-4 py-3">
        <Text className="text-field-foreground">{formatted}</Text>
        <IconSymbol name={mode === 'date' ? 'calendar' : 'clock'} size={18} color={muted} />
      </Pressable>

      {Platform.OS === 'android' && isOpen ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="rounded-md">
              <Dialog.Title className="mb-2">{label}</Dialog.Title>
              <DateTimePicker
                value={value}
                mode={mode}
                display="spinner"
                minimumDate={minimumDate}
                onChange={(_, selected) => selected && onChange(selected)}
              />
              <Button onPress={() => setIsOpen(false)} className="mt-4">
                Done
              </Button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      ) : null}
    </View>
  );
}
