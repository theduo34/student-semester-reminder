import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/shared/ModalHeader';

// Modal (presentation: "modal"), same shape as New Reminder — ModalHeader with no
// right-side action (nothing here to save). One of the few places the "Termio"
// wordmark is shown as text rather than the lockup.png asset, since this screen is
// explicitly about the app's identity — see components/features/auth/AuthHeader.tsx
// for the other (icon+wordmark+tagline lockup on the login screen).
export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const version = Constants.expoConfig?.version;
  const build =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;
  const versionLabel = version ? (build ? `Version ${version} (Build ${build})` : `Version ${version}`) : null;

  return (
    <View className="flex-1 bg-background">
      <ModalHeader title="About Termio" onClose={() => router.back()} />

      <View className="flex-1 px-6 pt-10" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="items-center">
          <Image
            source={require('@/assets/images/mark.png')}
            style={{ width: 88, height: 88 }}
            contentFit="contain"
          />
          <Text className="mt-4 text-3xl font-bold text-foreground">Termio</Text>
          {versionLabel ? <Text className="mt-1 text-sm text-muted">{versionLabel}</Text> : null}
        </View>

        <Text className="mt-10 text-base leading-6 text-foreground">
          Termio helps students at Koforidua Technical University stay on top of their
          semester. Your admin publishes your official course activities and
          institutional events. You add your own reminders for study blocks, prep
          sessions, and anything else you want to remember.
        </Text>

        <View className="flex-1" />

        <Text className="text-center text-xs text-muted">
          Built by Andrew Nana Beniako for KTU.
        </Text>
      </View>
    </View>
  );
}
