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
  callbacks: {
    // Opportunistically stamps institutionId when the signup email's domain matches a
    // seeded institution — not a gate, just a convenience so students at a known
    // institution get scoped automatically. Any other email is a perfectly valid
    // account with institutionId left unset (same as any row that predates this field
    // existing — every reader already treats "unset" as "no known institution").
    // Can't do this lookup inside profile() itself — that callback runs synchronously
    // with no database access — but this callback gets a real mutation ctx. Only ever
    // fires for a brand-new credentials signUp: per @convex-dev/auth's docs, "for
    // credentials providers, the callback is only called when createAccount is
    // called" — never on signIn/reset/email-verification.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId, type, profile }) {
      if (existingUserId !== null || type !== 'credentials' || typeof profile.email !== 'string') {
        return;
      }
      const emailDomain = profile.email.trim().toLowerCase().split('@')[1];
      if (!emailDomain) return;

      const institutions = await ctx.db.query('institutions').collect();
      const institution = institutions.find((row) => row.emailDomain.toLowerCase() === emailDomain);
      if (institution !== undefined) {
        await ctx.db.patch(userId, { institutionId: institution._id });
      }
    },
  },
});
