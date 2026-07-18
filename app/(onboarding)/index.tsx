import { Image } from 'expo-image';
import { Button, LinkButton } from 'heroui-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';

// Shown when authenticated + verified but no semester is published yet. The
// api.semesters.getActive subscription (in the root layout's auth gate) is what
// actually navigates away the instant a semester goes active — this screen never
// needs to poll. "Check now" only exists to reassure the student that we're still
// watching; there is nothing for it to actually (re)fetch.
export default function OnboardingScreen() {
  const { signOut } = useAuthActions();
  const [showReassurance, setShowReassurance] = useState(false);
  const reassuranceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheckNow = () => {
    setShowReassurance(true);
    if (reassuranceTimeout.current) {
      clearTimeout(reassuranceTimeout.current);
    }
    reassuranceTimeout.current = setTimeout(() => setShowReassurance(false), 3000);
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Image
          source={require('@/assets/images/mark.png')}
          style={{ width: 56, height: 56 }}
          contentFit="contain"
        />
        <Text className="text-center text-xl font-bold text-foreground">
          Waiting on your semester
        </Text>
        <Text className="text-center text-sm text-muted">
          Your academic admin hasn&apos;t published a semester yet. You&apos;ll be taken
          straight in the moment they do — no need to keep this screen open.
        </Text>

        <Button variant="secondary" className="mt-4" onPress={handleCheckNow}>
          <Button.Label>Check now</Button.Label>
        </Button>
        {showReassurance ? (
          <Text className="text-center text-xs text-muted">
            Still watching — nothing published yet.
          </Text>
        ) : null}

        <LinkButton className="mt-6" onPress={() => signOut()}>
          <LinkButton.Label className="text-muted">Log out</LinkButton.Label>
        </LinkButton>
      </View>
    </Screen>
  );
}
