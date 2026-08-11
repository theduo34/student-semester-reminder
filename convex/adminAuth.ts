import { getAuthUserId } from '@convex-dev/auth/server';

import { Doc } from './_generated/dataModel';
import { internalQuery, MutationCtx, QueryCtx } from './_generated/server';

// Shared by every admin-only mutation (institutional hierarchy today, Courses/Publish
// once those passes exist) — one guard, not one ad hoc auth check per file. Mirrors
// personalReminders.ts's requireOwnedReminder-style local-helper pattern, just
// promoted to its own module since multiple resource files need it. Client-side "you
// can't reach the admin screens" is UX, not security — this is the actual enforcement,
// same posture as AGENTS.md's Security section for per-student ownership checks.
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error('Not authenticated');
  }
  const user = await ctx.db.get(userId);
  if (user === null || user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
}

// Actions have no ctx.db (see documentImport.ts) — they can't call requireAdmin
// directly, only via ctx.runQuery, which is what this wraps it for. Internal, not
// public: the action calling it has already been reached through a public
// mutation/action of its own, this is just the auth check riding along on the same
// request, not a second entry point a client could call on its own.
export const requireAdminForAction = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
  },
});

// Only `faculties` carries institutionId directly (see schema.ts) — resolving it here
// rather than trusting a client-passed id keeps faculty creation consistent with every
// other ownership-derivation rule in this app. Falls back to the sole institutions row
// for a legacy admin account that predates the field, same posture schema.ts's own
// comment on users.institutionId documents and academicStructure.ts#listFaculties
// already applies on the read side.
export async function resolveAdminInstitutionId(
  ctx: QueryCtx | MutationCtx,
  admin: Doc<'users'>,
) {
  if (admin.institutionId !== undefined) {
    return admin.institutionId;
  }
  const institution = await ctx.db.query('institutions').first();
  if (institution === null) {
    throw new Error('No institution configured');
  }
  return institution._id;
}
