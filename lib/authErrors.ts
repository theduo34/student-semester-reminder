import { ConvexError } from 'convex/values';

// Convex Auth's Password/Email providers throw plain `Error`s with terse internal
// codes as the message (verified against the current source, not just examples —
// e.g. "InvalidSecret", "TooManyFailedAttempts", "Account ... already exists"). Plain
// `Error` messages get redacted to a generic "Server Error" on production Convex
// deployments (ConvexError is the only exception), so this matching only resolves to
// a specific message during local/dev testing — the fallback below covers prod.
export function getAuthErrorMessage(error: unknown): string {
  // convex/auth.ts's own domain-validation rejection throws ConvexError specifically
  // so this message survives the plain-Error redaction described above.
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return error.data;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('InvalidAccountId') || message.includes('InvalidSecret')) {
    return 'Incorrect email or password.';
  }
  if (message.includes('TooManyFailedAttempts')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (message.includes('already exists')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (message.includes('Invalid password')) {
    return 'Password must be at least 8 characters.';
  }
  if (message.includes('Could not verify code') || message.includes('Invalid code')) {
    return 'That code is incorrect or has expired. Request a new one and try again.';
  }
  return 'Something went wrong. Please try again.';
}
