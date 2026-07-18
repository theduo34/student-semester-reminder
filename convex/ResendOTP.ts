import { Email } from '@convex-dev/auth/providers/Email';
import { generateRandomString, RandomReader } from '@oslojs/crypto/random';
import { Resend as ResendAPI } from 'resend';

export const ResendOTP = Email({
  id: 'resend-otp',
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, '0123456789', 6);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    // onboarding@resend.dev works without a verified domain — swap for a real
    // verified Termio domain address before any production deployment.
    const { error } = await resend.emails.send({
      from: 'Termio <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Termio verification code',
      text: `Your verification code is ${token}. It expires in 15 minutes.`,
    });
    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
