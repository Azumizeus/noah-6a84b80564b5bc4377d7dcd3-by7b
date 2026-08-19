// ═══════════════════════════════════════════════════════
// BuildPact — Persistance distante des profils builders
// Supabase (Postgres + RLS) — table builder_profiles
// ═══════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isRemoteEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isRemoteEnabled
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : null;

export interface RemoteProfile {
  wallet: string;
  display_name: string;
  bio: string;
  roles: string[];
  skills: string[];
  links: Record<string, string>;
  available: boolean;
  updated_at?: string;
}

/** Charge le profil d'un wallet (null si inexistant) */
export async function fetchProfile(wallet: string): Promise<RemoteProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('builder_profiles')
    .select('*')
    .eq('wallet', wallet)
    .maybeSingle();
  if (error) {
    console.error('[profileRemote] fetch error:', error.message);
    return null;
  }
  return data as RemoteProfile | null;
}

/** Crée ou met à jour le profil (upsert sur la clé wallet) */
export async function upsertProfile(profile: RemoteProfile): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('builder_profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'wallet' });
  if (error) {
    console.error('[profileRemote] upsert error:', error.message);
    return false;
  }
  return true;
}

/** Liste tous les profils disponibles (annuaire builders) */
export async function listAvailableProfiles(): Promise<RemoteProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('builder_profiles')
    .select('*')
    .eq('available', true)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[profileRemote] list error:', error.message);
    return [];
  }
  return (data ?? []) as RemoteProfile[];
}
