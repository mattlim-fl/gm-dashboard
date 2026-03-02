/**
 * Centralized environment configuration
 * Access environment variables through this module for type safety
 */

interface AppConfig {
  /** Base URL for the backend API */
  apiBaseUrl: string;
  /** Supabase project URL */
  supabaseUrl: string;
  /** Supabase anon key */
  supabaseAnonKey: string;
  /** Whether we're in development mode */
  isDev: boolean;
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  isDev: import.meta.env.DEV,
};
