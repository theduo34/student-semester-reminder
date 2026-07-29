// Static allowlist of institution email domains recognized at signup. Kept here as a
// plain synchronous array — not queried from the `institutions` table — because Convex
// Auth's Password `profile()` callback (convex/auth.ts) must run synchronously and has
// no database access. This array only gates *which* domains are accepted at signup
// time; it isn't the institution record itself (name, id, etc. still live only in the
// `institutions` table, the single source of truth used everywhere else in this app —
// see convex/schema.ts). Add a new institution's domain here AND seed a matching
// `institutions` row (see convex/seed.ts) — auth.ts's afterUserCreatedOrUpdated
// callback resolves the real institutions._id from this same domain once the account
// actually exists (that callback DOES have database access).
export const KNOWN_INSTITUTION_DOMAINS = ['ktu.edu.gh'] as const;

export function matchInstitutionDomain(email: string): string | null {
  const lower = email.trim().toLowerCase();
  return KNOWN_INSTITUTION_DOMAINS.find((domain) => lower.endsWith(`@${domain}`)) ?? null;
}
