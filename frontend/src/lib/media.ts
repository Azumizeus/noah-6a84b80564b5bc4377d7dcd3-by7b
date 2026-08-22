// src/lib/media.ts
// ═══════════════════════════════════════════════════════════════════
// Logo + bannière de projet — upload réel vers Supabase Storage (bucket
// "project-media", public). Off-chain volontairement (comme role_interests
// / pact_events) : le compte Project on-chain a déjà un budget d'octets
// serré, stocker des images dessus serait hors de prix. Une seule ligne
// par projet dans project_media (upsert), pas de vérification serveur de
// signature wallet — même modèle de confiance que les autres tables MVP.
// Voir supabase/project_media.sql pour le schéma.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isRemoteEnabled } from './supabaseClient';
import { translate, type Lang } from './i18n/translations';

export { isRemoteEnabled as mediaEnabled };

function currentLang(): Lang {
  try {
    const stored = localStorage.getItem('buildpact_lang');
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* non bloquant */
  }
  return 'fr';
}
function tr(key: string, params?: Record<string, string | number>): string {
  return translate(currentLang(), key, params);
}

export interface ProjectMedia {
  projectPda: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  pitchVideoUrl: string | null;
}

const BUCKET = 'project-media';
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 Mo
const MAX_BANNER_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Valide un fichier AVANT l'upload — évite un aller-retour réseau pour rien. */
export function validateMediaFile(file: File, kind: 'logo' | 'banner'): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return tr('errors.mediaBadFormat');
  }
  const max = kind === 'logo' ? MAX_LOGO_BYTES : MAX_BANNER_BYTES;
  if (file.size > max) {
    return tr('errors.mediaTooLarge', { max: (max / 1024 / 1024).toFixed(0) });
  }
  return null;
}

function extFromFile(file: File): string {
  const fromType = file.type.split('/')[1];
  return fromType === 'jpeg' ? 'jpg' : fromType || 'png';
}

/**
 * Upload un logo ou une bannière pour un projet (chemin déterministe
 * `<projectPda>/<kind>.<ext>`, upsert — un ré-upload remplace l'ancien),
 * puis enregistre l'URL publique dans project_media.
 */
export async function uploadProjectMedia(
  projectPda: string,
  file: File,
  kind: 'logo' | 'banner'
): Promise<{ url: string } | { error: string }> {
  if (!supabase) return { error: tr('errors.notConfigured') };

  const invalid = validateMediaFile(file, kind);
  if (invalid) return { error: invalid };

  const path = `${projectPda}/${kind}.${extFromFile(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600' });

  if (uploadError) {
    console.warn('[media] upload error:', uploadError.message);
    return { error: tr('errors.uploadFailed') };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust : le chemin est déterministe (même URL si on remplace le
  // fichier), on ajoute un ?t= pour forcer le navigateur à recharger la
  // nouvelle image plutôt que de servir l'ancienne depuis son cache.
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const column = kind === 'logo' ? 'logo_url' : 'banner_url';
  const { error: upsertError } = await supabase
    .from('project_media')
    .upsert(
      { project_pda: projectPda, [column]: url, updated_at: new Date().toISOString() },
      { onConflict: 'project_pda' }
    );

  if (upsertError) {
    console.warn('[media] db upsert error:', upsertError.message);
    return { error: tr('errors.uploadSavedFailed') };
  }

  return { url };
}

function fromRemote(row: Record<string, unknown>): ProjectMedia {
  return {
    projectPda: row.project_pda as string,
    logoUrl: (row.logo_url as string | null) ?? null,
    bannerUrl: (row.banner_url as string | null) ?? null,
    pitchVideoUrl: (row.pitch_video_url as string | null) ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Vidéo de présentation founder — LIEN EXTERNE uniquement (YouTube/Loom/
// Vimeo), pas d'upload de fichier. Choix volontaire : une vidéo pèse bien
// plus lourd qu'un logo/bannière et saturerait vite le quota gratuit
// Supabase Storage (~1 Go) ; un lien vers un hébergeur vidéo dédié est plus
// fiable et plus rapide à charger pour un juge qui clique le lien démo.
// ═══════════════════════════════════════════════════════════════════

/** Détecte l'hébergeur d'une URL vidéo et son ID, ou null si non supporté. */
function parseVideoUrl(url: string): { host: 'youtube' | 'loom' | 'vimeo'; id: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v');
    if (id) return { host: 'youtube', id };
    const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) return { host: 'youtube', id: shorts[1] };
    return null;
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? { host: 'youtube', id } : null;
  }
  if (host === 'loom.com') {
    const m = u.pathname.match(/^\/share\/([\w-]+)/);
    return m ? { host: 'loom', id: m[1] } : null;
  }
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/^\/(\d+)/);
    return m ? { host: 'vimeo', id: m[1] } : null;
  }
  return null;
}

/** Message d'erreur si l'URL n'est pas un lien YouTube/Loom/Vimeo valide, sinon null. */
export function validateVideoUrl(url: string): string | null {
  if (!url.trim()) return null; // vide = pas de vidéo, valide (permet d'en retirer une)
  if (!parseVideoUrl(url)) {
    return tr('errors.videoLinkInvalid');
  }
  return null;
}

/** Convertit une URL "watch" en URL embarquable dans un <iframe>, ou null si non supporté. */
export function toEmbedUrl(url: string): string | null {
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;
  switch (parsed.host) {
    case 'youtube':
      return `https://www.youtube.com/embed/${parsed.id}`;
    case 'loom':
      return `https://www.loom.com/embed/${parsed.id}`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${parsed.id}`;
  }
}

/** Enregistre (ou efface, si url vide) le lien vidéo de présentation d'un projet. */
export async function setProjectVideo(
  projectPda: string,
  url: string
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: tr('errors.notConfigured') };
  const invalid = validateVideoUrl(url);
  if (invalid) return { error: invalid };

  const { error } = await supabase
    .from('project_media')
    .upsert(
      {
        project_pda: projectPda,
        pitch_video_url: url.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_pda' }
    );

  if (error) {
    console.warn('[media] video upsert error:', error.message);
    return { error: tr('errors.videoSaveFailed') };
  }
  return { ok: true };
}

/** Charge TOUS les médias en un seul appel — pour les listes (Pacts/Marketplace), évite le N+1. */
export async function fetchAllProjectMedia(): Promise<Map<string, ProjectMedia>> {
  const map = new Map<string, ProjectMedia>();
  if (!supabase) return map;
  const { data, error } = await supabase.from('project_media').select('*');
  if (error) {
    console.warn('[media] fetch all error:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    const m = fromRemote(row);
    map.set(m.projectPda, m);
  }
  return map;
}

/** Charge le média d'UN seul projet (fiche publique isolée). */
export async function fetchProjectMedia(projectPda: string): Promise<ProjectMedia | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('project_media')
    .select('*')
    .eq('project_pda', projectPda)
    .maybeSingle();
  if (error || !data) return null;
  return fromRemote(data);
}
