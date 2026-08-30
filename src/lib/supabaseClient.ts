// src/lib/supabaseClient.ts
// ═══════════════════════════════════════════════════════════════════
// Client Supabase PARTAGÉ — une seule instance pour tout le frontend
// (profils builders, fil d'activité Realtime, futur chat projet...).
// Évite l'avertissement "Multiple GoTrueClient instances" et garde une
// seule connexion Realtime WebSocket ouverte.
// ═══════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true si les variables d'env Supabase sont présentes (Vercel + .env local) */
export const isRemoteEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** URL de base du projet — utile pour construire l'URL d'une Edge Function
 *  (`${SUPABASE_PROJECT_URL}/functions/v1/<nom>`), voir lib/profileRemote.ts. */
export const SUPABASE_PROJECT_URL = SUPABASE_URL;

export const supabase: SupabaseClient | null = isRemoteEnabled
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : null;
