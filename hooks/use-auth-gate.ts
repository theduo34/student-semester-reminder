import { useConvexAuth, useQuery } from 'convex/react';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';

import { api } from '@/convex/_generated/api';
import { getHasSeenLandingSnapshot, subscribeHasSeenLanding } from '@/lib/landingStorage';

export type AuthGate =
  | { status: 'loading' }
  | { status: 'landing' }
  | { status: 'unauthenticated' }
  | { status: 'unverified'; email: string | undefined }
  | { status: 'needsProfile' }
  | { status: 'onboarding' }
  | { status: 'ready' };

// Single source of truth for the redirect decision described in AGENTS.md's alerts/
// onboarding flow — app/_layout.tsx and app/(auth)/_layout.tsx both read this instead
// of re-deriving auth/semester state themselves.
export function useAuthGate(): AuthGate {
  const hasSeenLanding = useSyncExternalStore(
    subscribeHasSeenLanding,
    getHasSeenLandingSnapshot,
    getHasSeenLandingSnapshot,
  );
  // undefined = not resolved yet, null = resolved, nothing pending — only a genuine
  // response object should bypass landing, so treat both non-response states as "no."
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const cameFromNotificationTap = Boolean(lastNotificationResponse);
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip');
  const isVerified = viewer?.emailVerificationTime !== undefined;
  const profile = useQuery(
    api.studentProfiles.getMyProfile,
    isAuthenticated && isVerified ? {} : 'skip',
  );
  const activeSemester = useQuery(
    api.semesters.getActive,
    isAuthenticated && isVerified && profile ? {} : 'skip',
  );

  if (hasSeenLanding === null || authLoading) {
    return { status: 'loading' };
  }
  if (!isAuthenticated) {
    // The landing carousel is a device-level "welcome to Termio" once-ever, not a
    // per-account one — a device that's already seen it skips straight to (auth), even
    // for a brand new account on that same device. Logged-in states below never
    // recheck this: if a session somehow exists on a device that hasn't marked landing
    // seen, that's already a returning device in every way that matters. A device
    // opened via a tapped push notification also skips it regardless — "notifications
    // go directly into the app" (see CLAUDE.md's push architecture section) beats
    // "device hasn't onboarded yet" (in practice this rarely applies: push only ever
    // reaches a device that was authenticated when its token was registered).
    return hasSeenLanding || cameFromNotificationTap ? { status: 'unauthenticated' } : { status: 'landing' };
  }
  if (viewer === undefined) {
    return { status: 'loading' };
  }
  // A valid session with no matching user row (e.g. the account was deleted
  // server-side) has nothing to onboard or verify — treat it like signed out.
  if (viewer === null) {
    return { status: 'unauthenticated' };
  }
  if (!isVerified) {
    return { status: 'unverified', email: viewer.email };
  }
  if (profile === undefined) {
    return { status: 'loading' };
  }
  if (profile === null) {
    return { status: 'needsProfile' };
  }
  if (activeSemester === undefined) {
    return { status: 'loading' };
  }
  return activeSemester === null ? { status: 'onboarding' } : { status: 'ready' };
}
