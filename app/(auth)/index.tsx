import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import { LinkButton, Tabs } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthHeader } from '@/components/features/auth/AuthHeader';
import { Button } from '@/components/ui/Button';
import { KeyboardAwareScreen } from '@/components/ui/KeyboardAwareScreen';
import { TextField } from '@/components/ui/TextField';
import { useAppToast } from '@/hooks/use-app-toast';
import { getAuthErrorMessage } from '@/lib/authErrors';
import { isValidEmail } from '@/lib/validation';

type AuthTab = 'login' | 'register';

// Login / register tabs, backed by the Convex Auth Password provider. No admin
// sign-in link here — the Academic Admin app is a separate app entirely.
export default function AuthScreen() {
  const [tab, setTab] = useState<AuthTab>('login');

  return (
    <KeyboardAwareScreen contentContainerClassName="pb-6">
      <AuthHeader />

      <Tabs value={tab} onValueChange={(value) => setTab(value as AuthTab)}>
        <Tabs.List className="w-full">
          <Tabs.Indicator />
          <Tabs.Trigger value="login" className="flex-1">
            <Tabs.Label>Log in</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="register" className="flex-1">
            <Tabs.Label>Register</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.List>

        <View className="pt-6">
          <Tabs.Content value="login">
            <LoginForm onRegisterLinkPress={() => setTab('register')} />
          </Tabs.Content>
          <Tabs.Content value="register">
            <RegisterForm onLoginLinkPress={() => setTab('login')} />
          </Tabs.Content>
        </View>
      </Tabs>
    </KeyboardAwareScreen>
  );
}

const STAGGER_STEP_MS = 60;
const STAGGER_DURATION_MS = 300;

function stagger(index: number) {
  return FadeInDown.delay(index * STAGGER_STEP_MS).duration(STAGGER_DURATION_MS);
}

function LoginForm({ onRegisterLinkPress }: { onRegisterLinkPress: () => void }) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { showError } = useAppToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = isValidEmail(email) && password.length > 0;

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      const result = await signIn('password', { email, password, flow: 'signIn' });
      if (!result.signingIn) {
        // Correct credentials, but the account isn't verified — Convex Auth already
        // re-sent a fresh code as a side effect of this call, see convex/auth.ts.
        router.push({ pathname: '/verify-email', params: { email } });
      }
      // else: signed in — the root layout's auth gate takes it from here.
    } catch (error) {
      console.error('[auth] sign-in failed:', error);
      showError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="gap-4">
      <Animated.View entering={stagger(0)}>
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

      <Animated.View entering={stagger(1)}>
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          icon="lock"
          secureTextEntry
          isRequired
          autoComplete="password"
          textContentType="password"
        />
      </Animated.View>

      <Animated.View entering={stagger(2)}>
        <LinkButton size="sm" className="self-end" onPress={() => router.push('/forgot-password')}>
          <LinkButton.Label className="text-accent">Forgot password?</LinkButton.Label>
        </LinkButton>
      </Animated.View>

      <Animated.View entering={stagger(3)} className="pt-2">
        <Button
          onPress={handleLogin}
          isDisabled={!canSubmit}
          isLoading={isSubmitting}
          loadingLabel="Logging in…">
          Log in
        </Button>
      </Animated.View>

      <Animated.View entering={stagger(4)} className="flex-row justify-center gap-1 pt-2">
        <Text className="text-sm text-muted">Don&apos;t have an account?</Text>
        <LinkButton size="sm" onPress={onRegisterLinkPress}>
          <LinkButton.Label className="text-accent">Register</LinkButton.Label>
        </LinkButton>
      </Animated.View>
    </View>
  );
}

function RegisterForm({ onLoginLinkPress }: { onLoginLinkPress: () => void }) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { showError } = useAppToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password ? "Passwords don't match" : undefined;

  const canSubmit =
    fullName.trim().length > 0 &&
    isValidEmail(email) &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !confirmError;

  const handleCreateAccount = async () => {
    setIsSubmitting(true);
    try {
      await signIn('password', { name: fullName, email, password, flow: 'signUp' });
      router.push({ pathname: '/verify-email', params: { email } });
    } catch (error) {
      console.error('[auth] sign-up failed:', error);
      showError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="gap-4">
      <Animated.View entering={stagger(0)}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ama Owusu"
          isRequired
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
      </Animated.View>

      <Animated.View entering={stagger(1)} className="gap-1">
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@ktu.edu.gh"
          icon="envelope"
          isRequired
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        {/* Client-side hint only — the actual enforcement is server-side, in
            convex/auth.ts's profile() callback (see convex/institutionDomains.ts). A
            wrong-domain email is rejected on submit either way; this just avoids
            surprising the student with an unexplained server error first. */}
        <Text className="ml-1 text-xs text-muted">Use your institutional email address.</Text>
      </Animated.View>

      <Animated.View entering={stagger(2)}>
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
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
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
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
        <Button
          onPress={handleCreateAccount}
          isDisabled={!canSubmit}
          isLoading={isSubmitting}
          loadingLabel="Creating account…">
          Create account
        </Button>
      </Animated.View>

      <Animated.View entering={stagger(5)} className="flex-row justify-center gap-1 pt-2">
        <Text className="text-sm text-muted">Already have an account?</Text>
        <LinkButton size="sm" onPress={onLoginLinkPress}>
          <LinkButton.Label className="text-accent">Log in</LinkButton.Label>
        </LinkButton>
      </Animated.View>
    </View>
  );
}
