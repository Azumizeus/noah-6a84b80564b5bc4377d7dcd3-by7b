<<<<<<< HEAD
export interface BuilderProfile { wallet: string; pseudo: string; bio: string; skills: string[]; links: { github?: string; twitter?: string; portfolio?: string }; availability: 'open' | 'busy' | 'closed'; updatedAt: number }
=======
export type SkillLevel = 'debutant' | 'confirme' | 'expert';
export interface BuilderProfile { wallet: string; pseudo: string; bio: string; skills: string[]; skillLevels: Record<string, SkillLevel>; links: { github?: string; twitter?: string; portfolio?: string }; availability: 'open' | 'busy' | 'closed'; avatarUrl: string | null; updatedAt: number }
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
const key = (wallet: string) => `buildpact_profile_${wallet}`;
export function loadProfile(wallet: string): BuilderProfile | null { try { const raw = localStorage.getItem(key(wallet)); return raw ? JSON.parse(raw) as BuilderProfile : null; } catch { return null; } }
export function saveProfile(profile: BuilderProfile): void { const next = { ...profile, updatedAt: Date.now() }; localStorage.setItem(key(profile.wallet), JSON.stringify(next)); }
export function hasProfile(wallet: string): boolean { return loadProfile(wallet) !== null; }
<<<<<<< HEAD
export const AVAILABILITY_META: Record<BuilderProfile['availability'], { emoji: string; label: string }> = { open: { emoji: '🟢', label: 'Disponible' }, busy: { emoji: '🟠', label: 'Occupé' }, closed: { emoji: '🔴', label: 'Indisponible' } };
=======
// labelKey pointe vers translations.ts (profile.availabilityXxx) — le libellé
// affiché doit suivre la langue courante, donc pas de texte en dur ici.
export const AVAILABILITY_META: Record<BuilderProfile['availability'], { emoji: string; labelKey: string }> = { open: { emoji: '🟢', labelKey: 'profile.availabilityOpen' }, busy: { emoji: '🟠', labelKey: 'profile.availabilityBusy' }, closed: { emoji: '🔴', labelKey: 'profile.availabilityClosed' } };
// labelKey pointe vers translations.ts (profile.levelXxx) — même raison que
// AVAILABILITY_META : le libellé doit suivre la langue courante.
export const SKILL_LEVEL_META: Record<SkillLevel, { labelKey: string }> = { debutant: { labelKey: 'profile.levelDebutant' }, confirme: { labelKey: 'profile.levelConfirme' }, expert: { labelKey: 'profile.levelExpert' } };
export const SKILL_LEVELS: SkillLevel[] = ['debutant', 'confirme', 'expert'];
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
