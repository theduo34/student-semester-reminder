import { Menu, useThemeColor } from 'heroui-native';
import { ReactNode } from 'react';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

export type ActionSheetAction = {
  key: string;
  label: string;
  icon?: IconSymbolName;
  variant?: 'default' | 'danger';
  isDisabled?: boolean;
  onSelect: () => void;
};

type ActionSheetProps = {
  trigger: ReactNode;
  actions: ActionSheetAction[];
};

// The three-dot "..." context menu — wraps heroui-native's own Menu (a floating popover
// with its own positioning/collision handling) rather than a hand-rolled sheet, per the
// library-first, reuse-first rule. First used on Activity Details' header action; the
// same trigger-icon-plus-list-of-actions shape is expected on activity list rows and
// personal reminder cards later, so it's shared from the start instead of copied when
// that need actually arrives.
export function ActionSheet({ trigger, actions }: ActionSheetProps) {
  const foreground = useThemeColor('foreground');
  const danger = useThemeColor('danger');

  return (
    <Menu>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay />
        <Menu.Content presentation="popover" placement="bottom" align="end" width={190} className="rounded-md">
          {actions.map((action) => (
            <Menu.Item
              key={action.key}
              variant={action.variant}
              isDisabled={action.isDisabled}
              onPress={action.onSelect}>
              {action.icon ? (
                <IconSymbol
                  name={action.icon}
                  size={16}
                  color={action.variant === 'danger' ? danger : foreground}
                />
              ) : null}
              <Menu.ItemTitle>{action.label}</Menu.ItemTitle>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
