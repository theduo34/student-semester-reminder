import { z } from 'zod';

// Every Convex deployment (dev, preview, and any future prod) always serves at
// https://<slug>.convex.cloud — validating the shape, not just presence, catches a
// copy-paste of the wrong var (e.g. the dashboard URL or the site/http URL) at startup
// instead of a confusing runtime failure the first time a query fires.
const envSchema = z.object({
  EXPO_PUBLIC_CONVEX_URL: z
    .string()
    .url()
    .regex(/^https:\/\/[a-z0-9-]+\.convex\.cloud$/),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
});

if (!parsed.success) {
  throw new Error(
    'Missing or malformed EXPO_PUBLIC_CONVEX_URL (expected https://<slug>.convex.cloud). ' +
      'Did you run `npx convex dev` (dev) or point .env.local at the right deployment ' +
      '(preview: see CLAUDE.md\'s "Deployments" section)?',
  );
}

export const CONVEX_URL = parsed.data.EXPO_PUBLIC_CONVEX_URL;
