import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

import { ResendOTP } from './ResendOTP';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: ResendOTP,
      profile(params) {
        return {
          email: params.email as string,
          name: params.name as string,
          // Every account created through this public register flow is a student —
          // the only way an account ever gets role: 'admin' is convex/admins.ts's
          // internal createAdminAccount, which never runs through this provider
          // callback at all (it calls createAccount directly). See AGENTS.md's Admin
          // account section.
          role: 'student' as const,
        };
      },
    }),
  ],
});
