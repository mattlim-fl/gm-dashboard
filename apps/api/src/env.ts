import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from apps/api/.env in development
dotenv.config();

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  PORT: z.string().optional(),
  API_ALLOWED_ORIGINS: z.string().optional(), // comma-separated
  API_CRON_SECRET: z.string().optional(),

  // Credentials encryption (for venue_api_credentials)
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(16).optional(),

  // Xero OAuth
  XERO_CLIENT_ID: z.string().min(1),
  XERO_CLIENT_SECRET: z.string().min(1),
  XERO_REDIRECT_URI: z.string().url(),
  XERO_SCOPES: z.string().min(1),
  XERO_TOKEN_ENCRYPTION_KEY: z.string().min(16), // Fallback for CREDENTIALS_ENCRYPTION_KEY
});

export const env = EnvSchema.parse(process.env);


