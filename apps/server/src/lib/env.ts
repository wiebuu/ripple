import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  anthropicKey: process.env.ANTHROPIC_API_KEY || null,
  aiModel: process.env.AI_MODEL ?? 'claude-sonnet-5-5',
  /** Artificial latency so loading states are visible in demos. */
  simLatencyMs: Number(process.env.SIM_LATENCY_MS ?? 250),
  publicUrl: process.env.PUBLIC_URL ?? '',
};

if (process.env.NODE_ENV === 'production' && env.jwtSecret === 'dev-only-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
