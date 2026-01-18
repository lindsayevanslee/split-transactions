import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const recaptchaSecret = defineSecret('RECAPTCHA_SECRET_KEY');

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export const verifyRecaptcha = onCall(
  { secrets: [recaptchaSecret] },
  async (request) => {
    const { token, action } = request.data as { token?: string; action?: string };

    if (!token) {
      throw new HttpsError('invalid-argument', 'Missing reCAPTCHA token');
    }

    const secretValue = recaptchaSecret.value();
    if (!secretValue) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      throw new HttpsError('internal', 'reCAPTCHA not configured');
    }

    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secretValue}&response=${token}`,
      });

      const result: RecaptchaResponse = await response.json();

      if (!result.success) {
        console.warn('reCAPTCHA verification failed:', result['error-codes']);
        throw new HttpsError('permission-denied', 'reCAPTCHA verification failed');
      }

      // Check score (0.0 = bot, 1.0 = human) - 0.5 is a common threshold
      if (result.score !== undefined && result.score < 0.5) {
        console.warn(`Low reCAPTCHA score: ${result.score}`);
        throw new HttpsError('permission-denied', 'Suspicious activity detected');
      }

      // Verify the action matches if provided
      if (action && result.action !== action) {
        console.warn(`Action mismatch: expected ${action}, got ${result.action}`);
        throw new HttpsError('permission-denied', 'Action mismatch');
      }

      return { success: true, score: result.score };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error('reCAPTCHA verification error:', error);
      throw new HttpsError('internal', 'Failed to verify reCAPTCHA');
    }
  }
);
