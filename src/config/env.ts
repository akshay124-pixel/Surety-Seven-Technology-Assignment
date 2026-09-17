import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_URL: z.string().url().optional(),

  APPLICANT_API_URL: z.string().url(),
  APPLICANT_API_TIMEOUT_MS: z.string().transform(Number).default('5000'),
  APPLICANT_API_MAX_RETRIES: z.string().transform(Number).default('3'),

  DOWNSTREAM_API_URL: z.string().url(),
  DOWNSTREAM_API_TIMEOUT_MS: z.string().transform(Number).default('5000'),
  DOWNSTREAM_API_MAX_RETRIES: z.string().transform(Number).default('5'),

  QUEUE_EVALUATION_CONCURRENCY: z.string().transform(Number).default('5'),
  QUEUE_NOTIFICATION_CONCURRENCY: z.string().transform(Number).default('3'),

  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
});

export type Config = z.infer<typeof envSchema>;

let config: Config;

export function loadConfig(): Config {
  try {
    config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line no-console
      console.error('❌ Invalid environment configuration:');
      error.errors.forEach((err) => {
        // eslint-disable-next-line no-console
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}
