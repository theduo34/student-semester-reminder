const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UI-level format check only — enabling/disabling a submit button, not a substitute for
// real backend validation (duplicate-email checks etc. need the auth backend).
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
