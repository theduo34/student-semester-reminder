import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import { KNOWN_INSTITUTION_DOMAINS, matchInstitutionDomain } from './institutionDomains';
import { ResendOTP } from './ResendOTP';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: ResendOTP,
      profile(params) {
        const email = params.email as string;

        // profile() is called for EVERY flow (signUp, signIn, reset, ...), not just
        // signUp — but Password.js's authorize() only ever *uses* this return value on
        // the signUp branch (passed to createAccount); signIn's own branch
        // (retrieveAccount) only reads `.email` off it and discards the rest. Gating
        // this check to signUp is therefore both correct and necessary — a returning
        // student's email was already validated at their own signup time and must
        // never be re-checked (or silently broken by a later-added institution) on
        // every login.
        if (params.flow === 'signUp' && matchInstitutionDomain(email) === null) {
          // ConvexError (not a plain Error) so the message survives production's
          // "Server Error" redaction of plain Error messages — see lib/authErrors.ts.
          throw new ConvexError(
            `Please use your institutional email address (e.g. name@${KNOWN_INSTITUTION_DOMAINS[0]}).`,
          );
        }

        return {
          email,
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
    // Resolves and stamps institutionId from the email domain profile() already
    // validated above. Can't do this inside profile() itself — that callback runs
    // synchronously with no database access (see convex/institutionDomains.ts) — but
    // this callback gets a real mutation ctx. Only ever fires for a brand-new
    // credentials signUp: per @convex-dev/auth's docs, "for credentials providers, the
    // callback is only called when createAccount is called" — never on signIn/reset/
    // email-verification, matching the same signUp-only rule profile() enforces.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId, type, profile }) {
      if (existingUserId !== null || type !== 'credentials' || typeof profile.email !== 'string') {
        return;
      }
      const domain = matchInstitutionDomain(profile.email);
      if (domain === null) return; // already rejected in profile() above; defensive only

      const institutions = await ctx.db.query('institutions').collect();
      const institution = institutions.find((row) => row.emailDomain.toLowerCase() === domain);
      if (institution !== undefined) {
        await ctx.db.patch(userId, { institutionId: institution._id });
      }
    },
  },
});
