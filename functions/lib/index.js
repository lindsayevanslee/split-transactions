"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRecaptcha = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const recaptchaSecret = (0, params_1.defineSecret)('RECAPTCHA_SECRET_KEY');
exports.verifyRecaptcha = (0, https_1.onCall)({ secrets: [recaptchaSecret] }, async (request) => {
    const { token, action } = request.data;
    if (!token) {
        throw new https_1.HttpsError('invalid-argument', 'Missing reCAPTCHA token');
    }
    const secretValue = recaptchaSecret.value();
    if (!secretValue) {
        console.error('RECAPTCHA_SECRET_KEY not configured');
        throw new https_1.HttpsError('internal', 'reCAPTCHA not configured');
    }
    try {
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${secretValue}&response=${token}`,
        });
        const result = await response.json();
        if (!result.success) {
            console.warn('reCAPTCHA verification failed:', result['error-codes']);
            throw new https_1.HttpsError('permission-denied', 'reCAPTCHA verification failed');
        }
        // Check score (0.0 = bot, 1.0 = human) - 0.5 is a common threshold
        if (result.score !== undefined && result.score < 0.5) {
            console.warn(`Low reCAPTCHA score: ${result.score}`);
            throw new https_1.HttpsError('permission-denied', 'Suspicious activity detected');
        }
        // Verify the action matches if provided
        if (action && result.action !== action) {
            console.warn(`Action mismatch: expected ${action}, got ${result.action}`);
            throw new https_1.HttpsError('permission-denied', 'Action mismatch');
        }
        return { success: true, score: result.score };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error('reCAPTCHA verification error:', error);
        throw new https_1.HttpsError('internal', 'Failed to verify reCAPTCHA');
    }
});
//# sourceMappingURL=index.js.map