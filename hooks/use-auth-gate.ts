import { useConvexAuth, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';

export type AuthGate =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'unverified'; email: string | undefined }
  | { status: 'needsProfile' }
  | { status: 'onboarding' }
  | { status: 'ready' };

// Single source of truth for the redirect decision described in AGENTS.md's alerts/
// onboarding flow — app/_layout.tsx and app/(auth)/_layout.tsx both read this instead
// of re-deriving auth/semester state themselves.
export function useAuthGate(): AuthGate {
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

  if (authLoading) {
    return { status: 'loading' };
  }
  if (!isAuthenticated) {
    return { status: 'unauthenticated' };
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
