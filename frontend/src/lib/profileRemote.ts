// ═══════════════════════════════════════════════════════
// BuildPact — Persistance distante des profils builders
// Supabase (Postgres + RLS) — table builder_profiles
// ═══════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';
import type { BuilderProfile } from './profile';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isRemoteEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isRemoteEnabled
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : null;

// ── Mapping local (BuilderProfile) ↔ SQL (builder_profiles) ──
function toRemote(p: BuilderProfile) {
  return {
    wallet: p.wallet,
    display_name: p.pseudo,
    bio: p.bio,
    roles: p.skills,          // on stocke les skills dans roles+skills
    skills: p.skills,
    links: p.links,
    available: p.availability === 'open',
    updated_at: new Date().toISOString(),
  };
}

function fromRemote(row: Record<string, unknown>): BuilderProfile {
  return {
    wallet: row.wallet as string,
    pseudo: (row.display_name as string) ?? '',
    bio: (row.bio as string) ?? '',
    skills: (row.skills as string[]) ?? [],
    links: (row.links as Record<string, string>) ?? {},
    availability: row.available ? 'open' : 'busy',
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : 0,
  };
}

/** Charge le profil d'un wallet (null si inexistant ou erreur) */
export async function fetchProfile(wallet: string): Promise<BuilderProfile | null> {
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
  return data ? fromRemote(data) : null;
}

/** Crée ou met à jour le profil (upsert sur la clé wallet) */
export async function upsertProfile(profile: BuilderProfile): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('builder_profiles')
    .upsert(toRemote(profile), { onConflict: 'wallet' });
  if (error) {
    console.error('[profileRemote] upsert error:', error.message);
    return false;
  }
  return true;
}

/** Liste tous les profils disponibles (annuaire builders — Phase 2) */
export async function listAvailableProfiles(): Promise<BuilderProfile[]> {
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
  return (data ?? []).map(fromRemote);
}
