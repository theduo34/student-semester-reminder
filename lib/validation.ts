const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UI-level format check only — enabling/disabling a submit button, not a substitute for
// real backend validation (duplicate-email checks etc. need the auth backend).
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

// Ghanaian mobile numbers: 0XXXXXXXXX (10 digits) or +233/233 + 9 digits. UI-level
// format check only, same caveat as isValidEmail above.
const PHONE_PATTERN = /^(?:\+?233|0)\d{9}$/;
export function isValidPhoneNumber(value: string): boolean {
  return PHONE_PATTERN.test(value.trim().replace(/[\s-]/g, ''));
}
