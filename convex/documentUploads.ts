import { mutation } from './_generated/server';
import { requireAdmin } from './adminAuth';

// Deliberately its own (non-Node) file: documentImport.ts's 'use node' directive means
// every export there runs in the Node runtime, and Convex only allows
// actions/internalActions in a Node.js file — this plain mutation can't live there.
//
// Admin uploads a source document (a PDF timetable/calendar) here first, then passes
// the resulting storageId to documentImport.ts#parseAcademicCalendar — same two-step
// upload flow as institutions.ts's logo upload, the standard Convex pattern.
export const generateImportUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
