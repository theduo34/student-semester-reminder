import { Label, Select } from 'heroui-native';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { IconSymbol } from '@/components/ui/icon-symbol';

export type PickerOption = { value: string; label: string };

type HierarchyPickerProps = {
  label: string;
  placeholder: string;
  options: PickerOption[];
  value: PickerOption | undefined;
  onValueChange: (option: PickerOption) => void;
  isDisabled?: boolean;
};

// Shared by every step of the Faculty -> Department -> Program -> Level -> Session ->
// Division cascade on Profile Setup — same disabled-until-populated Select wrapper six
// times over. The resolved checkmark next to the label is what makes a 6-step cascade
// read as "guided progression" rather than a flat list of dropdowns — see the progress
// bar in profile-setup.tsx, which counts the same resolved state.
export function HierarchyPicker({
  label,
  placeholder,
  options,
  value,
  onValueChange,
  isDisabled,
}: HierarchyPickerProps) {
  const [success] = useCSSVariable(['--success']) as [string];
  const isResolved = Boolean(value);

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Label>{label}</Label>
        {isResolved ? (
          <IconSymbol name="checkmark.circle.fill" size={14} color={success} />
        ) : null}
      </View>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next && !Array.isArray(next)) {
            onValueChange(next);
          }
        }}
        isDisabled={isDisabled || options.length === 0}>
        <Select.Trigger>
          <Select.Value placeholder={placeholder} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          <Select.Content presentation="popover" width="trigger">
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} label={option.label} />
            ))}
          </Select.Content>
        </Select.Portal>
      </Select>
    </View>
  );
}
