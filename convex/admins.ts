import { createAccount, modifyAccountCredentials } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { internalAction, internalMutation } from './_generated/server';

// The ONLY way an admin account is ever created in this app — no public mutation, no
// client-facing admin signup screen anywhere (see AGENTS.md's Admin account section).
// Runnable from the Convex dashboard's Functions tab, or:
//   npx convex run admins:createAdminAccount '{"email": "admin@example.com",
//     "password": "secure_password", "name": "Andrew Admin",
//     "institutionId": "<id from the institutions table>"}'
// See README.md for the full walkthrough (including how to find institutionId).
//
// This is an internalAction, not an internalMutation — @convex-dev/auth's
// `createAccount`/`modifyAccountCredentials` both require action context (they run the
// Password provider's credential-hashing pipeline, the same one
// `signIn(..., { flow: "signUp" })` uses from the client), which a mutation context
// can't provide. Either way it's equally unreachable from the mobile app — both
// internalMutation and internalAction are "never callable by a client," which is the
// actual security property here, not the specific function kind.
//
// Re-running this with an email that already has an account resets its password (via
// modifyAccountCredentials) and refreshes name/institutionId — the MVP's entire
// "forgot admin password" story, since there's no self-service reset flow for admins.
// Admin passwords should be strong precisely because of this: there's no verification
// email and no reset flow guarding against a leaked one, just this one re-runnable
// escape hatch.
export const createAdminAccount = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    institutionId: v.id('institutions'),
  },
  handler: async (ctx, { email, password, name, institutionId }): Promise<Id<'users'>> => {
    const existingUserId: Id<'users'> | null = await ctx.runQuery(internal.users.findUserIdByEmail, { email });

    if (existingUserId === null) {
      const created = await createAccount(ctx, {
        provider: 'password',
        account: { id: email, secret: password },
        profile: {
          email,
          name,
          role: 'admin',
          institutionId,
          // Set directly, same trick convex/seed.ts's seedDemoStudent uses — admins
          // skip email verification entirely, they never get a verification email.
          emailVerificationTime: Date.now(),
        },
        shouldLinkViaEmail: true,
      });
      return created.user._id;
    }

    await modifyAccountCredentials(ctx, {
      provider: 'password',
      account: { id: email, secret: password },
    });
    await ctx.runMutation(internal.admins.setAdminFields, { userId: existingUserId, name, institutionId });
    return existingUserId;
  },
});

// Split out from createAdminAccount's handler because runMutation is how an action
// writes to the database — it can't call ctx.db.patch directly.
export const setAdminFields = internalMutation({
  args: { userId: v.id('users'), name: v.string(), institutionId: v.id('institutions') },
  handler: async (ctx, { userId, name, institutionId }) => {
    await ctx.db.patch(userId, {
      name,
      role: 'admin',
      institutionId,
      emailVerificationTime: Date.now(),
    });
  },
});
