import 'dotenv/config';

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 8787),
  upstreamBaseUrl: (process.env.UPSTREAM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
  upstreamApiKey: process.env.OPENAI_API_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean),
  allowAnonymous: (process.env.ALLOW_ANONYMOUS ?? 'true') !== 'false',
  databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  /** Run node-pg-migrate on server boot when DATABASE_URL is set. Set false in multi-instance prod. */
  runMigrationsOnStart: (process.env.RUN_MIGRATIONS_ON_START ?? 'true') !== 'false',
  clientAppUrl: (process.env.CLIENT_APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || undefined,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
  stripePricePro: process.env.STRIPE_PRICE_PRO?.trim() || undefined,
  stripePriceTeam: process.env.STRIPE_PRICE_TEAM?.trim() || undefined,
  quotas: {
    free: num(process.env.FREE_MONTHLY_TOKEN_QUOTA, 100_000),
    pro: num(process.env.PRO_MONTHLY_TOKEN_QUOTA, 5_000_000),
    team: num(process.env.TEAM_MONTHLY_TOKEN_QUOTA, 25_000_000),
  } as Record<Plan, number>,
  rateLimitRpm: num(process.env.RATE_LIMIT_RPM, 120),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  ocrMaxPages: num(process.env.OCR_MAX_PAGES, 15),
};

export type Plan = 'free' | 'pro' | 'team';

if (!config.upstreamApiKey) {
  console.warn('[config] OPENAI_API_KEY is not set — upstream calls will fail until it is configured.');
}
