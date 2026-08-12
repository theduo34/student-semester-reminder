import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Primary overdue-detection path — see convex/overdueSweep.ts for why
// hooks/useAlertsSync.ts's client-side check stays in place alongside this rather than
// being replaced by it.
crons.interval('overdue sweep', { minutes: 15 }, internal.overdueSweep.run, {});

// Keeps semesters.isActive following real semester dates for any semester admin
// hasn't manually pinned — see semesters.ts#syncActiveSemester for the full rule
// (a manual pin is never reverted by this).
crons.interval('sync active semester', { hours: 1 }, internal.semesters.syncActiveSemester, {});

export default crons;
