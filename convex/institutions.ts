import { v } from 'convex/values';

import { requireAdmin, resolveAdminInstitutionId } from './adminAuth';
import { mutation, query } from './_generated/server';

// Institution branding — just the logo today. Read by termio-admin's Settings page
// (to manage it) and by the protected layout's background watermark (to display it) —
// same admin-only gate as every other write in this app, see adminAuth.ts.
export const getBranding = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const institutionId = await resolveAdminInstitutionId(ctx, admin);
    const institution = await ctx.db.get(institutionId);
    if (institution === null || institution.logoStorageId === undefined) {
      return { logoUrl: null };
    }
    return { logoUrl: await ctx.storage.getUrl(institution.logoStorageId) };
  },
});

// Step 1 of the standard Convex file-upload flow: the client POSTs the file directly
// to this URL, gets back a storageId, then calls setInstitutionLogo below.
export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setInstitutionLogo = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const admin = await requireAdmin(ctx);
    const institutionId = await resolveAdminInstitutionId(ctx, admin);
    const institution = await ctx.db.get(institutionId);
    if (institution === null) {
      throw new Error('Institution not found');
    }
    // Replacing an existing logo — delete the old blob rather than leaving it
    // orphaned in storage.
    if (institution.logoStorageId !== undefined) {
      await ctx.storage.delete(institution.logoStorageId);
    }
    await ctx.db.patch(institutionId, { logoStorageId: storageId });
  },
});
