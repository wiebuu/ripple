import 'dotenv/config';

/**
 * Razorpay is enabled only with TEST keys. Live keys would move real money,
 * which this prototype must never do, so they are refused outright.
 */
function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (!keyId || !keySecret) return null;
  if (!keyId.startsWith('rzp_test_')) {
    console.error('[payments] RAZORPAY_KEY_ID is not a test key (must start with rzp_test_). Razorpay is DISABLED and payments are unavailable.');
    return null;
  }
  return { keyId, keySecret };
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  geminiKey: process.env.GEMINI_API_KEY || null,
  aiModel: process.env.AI_MODEL || 'gemini-flash-latest',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null,
  /** Firebase project Web API key (Project settings → General). Needed for Google sign-in. */
  firebaseWebApiKey: process.env.FIREBASE_WEB_API_KEY || null,
  /** Artificial latency so loading states are visible in demos. */
  simLatencyMs: Number(process.env.SIM_LATENCY_MS ?? 250),
  publicUrl: process.env.PUBLIC_URL ?? '',
  razorpay: razorpayConfig(),
  /** Test-card gateway used only by the automated API test suite (it can't drive Razorpay's checkout UI). Off by default. */
  allowSimulatedPayments: process.env.ALLOW_SIMULATED_PAYMENTS === '1',
};

if (process.env.NODE_ENV === 'production' && env.jwtSecret === 'dev-only-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
