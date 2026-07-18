import { ConvexReactClient } from 'convex/react';

import { CONVEX_URL } from '@/lib/env';

export const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});
