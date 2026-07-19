import { Description, FieldError, Input, Label, TextArea, TextField as HeroTextField } from 'heroui-native';
import { useState } from 'react';
import { Pressable, TextInputProps, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
  icon?: IconSymbolName;
  secureTextEntry?: boolean;
  /** Renders heroui's TextArea instead of Input — icon/password-toggle slots don't apply in this mode. */
  multiline?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

// The one text input across all five auth screens (and Profile Setup's text fields) —
// see CLAUDE.md. Wraps heroui-native's TextField/Input/Label/FieldError rather than
// styling from scratch; error border color and the required asterisk already come
// from that composition via TextField's isInvalid/isRequired context. Icon + password-
// toggle placement matches heroui-native's own documented pattern for Input (absolute
// positioning inside a flex-row + items-center wrapper — RN's layout engine centers an
// absolutely-positioned child on the cross axis when only the inline edge is set).
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  description,
  errorMessage,
  isRequired,
  icon,
  secureTextEntry,
  multiline,
  autoComplete,
  textContentType,
  keyboardType,
  autoCapitalize,
}: TextFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [muted] = useCSSVariable(['--muted']) as [string];
  const hasLeftIcon = Boolean(icon);
  const isSecure = Boolean(secureTextEntry);

  const inputPaddingClassName = ['rounded-md', hasLeftIcon && 'pl-10', isSecure && 'pr-10']
    .filter(Boolean)
    .join(' ');

  if (multiline) {
    return (
      <HeroTextField isRequired={isRequired} isInvalid={Boolean(errorMessage)}>
        <Label>{label}</Label>
        <TextArea
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          className="min-h-24 rounded-md"
        />
        {description ? <Description>{description}</Description> : null}
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      </HeroTextField>
    );
  }

  return (
    <HeroTextField isRequired={isRequired} isInvalid={Boolean(errorMessage)}>
      <Label>{label}</Label>
      <View className="w-full flex-row items-center">
        {icon ? (
          <IconSymbol
            name={icon}
            size={18}
            color={muted}
            style={{ position: 'absolute', left: 14, zIndex: 1 }}
          />
        ) : null}
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={isSecure && !isPasswordVisible}
          autoCapitalize={autoCapitalize ?? (isSecure ? 'none' : undefined)}
          autoComplete={autoComplete}
          textContentType={textContentType}
          keyboardType={keyboardType}
          className={['flex-1', inputPaddingClassName].filter(Boolean).join(' ')}
        />
        {isSecure ? (
          <Pressable
            className="absolute right-4"
            hitSlop={8}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}>
            <IconSymbol name={isPasswordVisible ? 'eye.slash' : 'eye'} size={18} color={muted} />
          </Pressable>
        ) : null}
      </View>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </HeroTextField>
  );
}
