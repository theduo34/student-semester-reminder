import { useRouter } from 'expo-router';
import { InputOTP, Label, LinkButton } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { TextField } from '@/components/ui/TextField';
import { isValidEmail } from '@/lib/validation';

type Step = 'request' | 'reset';

const STAGGER_STEP_MS = 60;

function stagger(index: number) {
  return FadeInDown.delay(index * STAGGER_STEP_MS).duration(300);
}

// Interface only, no wireframe for this screen. Two-step local UI state (mirrors Convex
// Auth's own reset-flow shape: request a code, then reset with it) rather than two
// routes — neither step calls the backend yet, deliberately (see AGENTS.md). No header
// here — "Back to log in" below is the one way back; a chevron up top on top of that
// link would be redundant, not extra safety.
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const confirmError =
    confirmNewPassword.length > 0 && confirmNewPassword !== newPassword
      ? "Passwords don't match"
      : undefined;

  const canSendCode = isValidEmail(email);
  const canReset =
    code.length === 6 && newPassword.length > 0 && confirmNewPassword.length > 0 && !confirmError;

  const handleSendCode = () => {
    // No email is actually sent — just flips to the "reset" step locally. Real
    // Convex Auth reset-request call lands in a later pass.
    setStep('reset');
  };

  const handleResetPassword = () => {
    // TODO: call Convex Auth's password-reset action once that pass lands.
    router.back();
  };

  return (
    <KeyboardAwareScreen contentContainerClassName="flex-grow justify-center gap-8 pb-6">
      <View className="gap-4">
        {step === 'request' ? (
          <>
            <Animated.View entering={stagger(0)}>
              <Text className="text-lg font-bold text-foreground">
                Enter your account email and we&apos;ll send you a reset code.
              </Text>
            </Animated.View>

            <Animated.View entering={stagger(1)}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                icon="envelope"
                isRequired
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </Animated.View>

            <Animated.View entering={stagger(2)} className="pt-2">
              <Button isDisabled={!canSendCode} onPress={handleSendCode}>
                Send reset code
              </Button>
            </Animated.View>
          </>
        ) : (
          <>
            <Animated.View entering={stagger(0)}>
              <Text className="text-lg font-bold text-foreground">
                Enter the code we sent to {email || 'your email'} and choose a new password.
              </Text>
            </Animated.View>

            <Animated.View entering={stagger(1)} className="items-center gap-3">
              <Label>Reset code</Label>
              <InputOTP value={code} onChange={setCode} maxLength={6}>
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group>
                  <InputOTP.Slot index={3} />
                  <InputOTP.Slot index={4} />
                  <InputOTP.Slot index={5} />
                </InputOTP.Group>
              </InputOTP>
            </Animated.View>

            <Animated.View entering={stagger(2)}>
              <TextField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter your password"
                icon="lock"
                secureTextEntry
                isRequired
                autoComplete="new-password"
                textContentType="newPassword"
              />
            </Animated.View>

            <Animated.View entering={stagger(3)}>
              <TextField
                label="Confirm new password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Enter your password"
                icon="lock"
                secureTextEntry
                isRequired
                errorMessage={confirmError}
                autoComplete="new-password"
                textContentType="newPassword"
              />
            </Animated.View>

            <Animated.View entering={stagger(4)} className="pt-2">
              <Button isDisabled={!canReset} onPress={handleResetPassword}>
                Reset password
              </Button>
            </Animated.View>
          </>
        )}
      </View>

      <LinkButton className="self-center" onPress={() => router.back()}>
        <LinkButton.Label className="text-accent">Back to log in</LinkButton.Label>
      </LinkButton>
    </KeyboardAwareScreen>
  );
}
