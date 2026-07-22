import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Primary overdue-detection path — see convex/overdueSweep.ts for why
// hooks/useAlertsSync.ts's client-side check stays in place alongside this rather than
// being replaced by it.
crons.interval('overdue sweep', { minutes: 15 }, internal.overdueSweep.run, {});

export default crons;
