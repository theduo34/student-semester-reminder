import { useAuthActions } from '@convex-dev/auth/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InputOTP, LinkButton } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { AppTopBar } from '@/components/shared/AppTopBar';
import { useAppToast } from '@/hooks/use-app-toast';
import { getAuthErrorMessage } from '@/lib/authErrors';

const STAGGER_STEP_MS = 60;

function stagger(index: number) {
  return FadeInDown.delay(index * STAGGER_STEP_MS).duration(300);
}

// No existing wireframe for this screen — built to match Login/Register's spacing and
// component styling. Content is centered as one group (description + code + Verify
// button), not pinned to the top with the button stranded at the bottom — see
// CLAUDE.md's spacing convention.
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { showError, showSuccess } = useAppToast();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const canSubmit = Boolean(email) && code.length === 6;

  const handleVerify = async () => {
    if (!email) return;
    setIsVerifying(true);
    try {
      await signIn('password', { email, code, flow: 'email-verification' });
      // On success the root layout's auth gate picks up isAuthenticated and navigates
      // away from here — nothing to do.
    } catch (error) {
      showError(getAuthErrorMessage(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    try {
      // Omitting `code` re-triggers Password's "email-verification" branch down the
      // path that generates a fresh code and sends it, rather than verifying one —
      // no password needed, since this lookup doesn't touch the account secret.
      await signIn('password', { email, flow: 'email-verification' });
      showSuccess('Code sent.');
    } catch (error) {
      showError(getAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <KeyboardAwareScreen
      header={<AppTopBar left="back" title="Verify email" />}
      contentContainerClassName="flex-grow justify-center gap-8">
      <View className="gap-6">
        <Animated.View entering={stagger(0)} className="items-center gap-2">
          <Text className="text-xl font-bold text-foreground">Verification code</Text>
          <Text className="text-center text-base text-muted">
            We sent a code to{' '}
            <Text className="text-base font-semibold text-foreground">
              {email || 'your email'}
            </Text>
          </Text>
        </Animated.View>

        <Animated.View entering={stagger(1)} className="items-center">
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

        <Animated.View entering={stagger(2)} className="pt-2">
          <Button
            onPress={handleVerify}
            isDisabled={!canSubmit}
            isLoading={isVerifying}
            loadingLabel="Verifying…">
            Verify
          </Button>
        </Animated.View>
      </View>

      <Animated.View entering={stagger(3)} className="items-center gap-3">
        <LinkButton onPress={handleResend} isDisabled={!email || isResending}>
          <LinkButton.Label className="text-accent">
            {isResending ? 'Sending…' : 'Resend code'}
          </LinkButton.Label>
        </LinkButton>
        <LinkButton onPress={() => router.back()}>
          <LinkButton.Label className="text-muted">Use a different email</LinkButton.Label>
        </LinkButton>
      </Animated.View>
    </KeyboardAwareScreen>
  );
}
