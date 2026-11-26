import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// The single .env file lives at the repo root (docker-compose reads it too).
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const bool = z
  .enum(['true', 'false'])
  .default('true')
  .transform((v) => v === 'true');

const schema = z.object({
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(200),
  ALLOW_SIGNUP: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment. Copy .env.example to .env and fill it in.');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
