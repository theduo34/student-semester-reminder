function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var ${name}. Did you run \`npx convex dev\`?`);
  }
  return value;
}

export const CONVEX_URL = required('EXPO_PUBLIC_CONVEX_URL', process.env.EXPO_PUBLIC_CONVEX_URL);
