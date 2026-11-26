import { defineConfig } from 'drizzle-kit';
import './src/config.ts';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
