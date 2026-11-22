import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase Cloud integration retired.
// The engine runs authoritative PostgreSQL 17 locally on port 5432 for zero-latency, high-concurrency offline resilience.
export function createAdminClient(): SupabaseClient | null {
  return null;
}
