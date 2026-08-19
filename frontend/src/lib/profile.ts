export interface BuilderProfile { wallet: string; pseudo: string; bio: string; skills: string[]; links: { github?: string; twitter?: string; portfolio?: string }; availability: 'open' | 'busy' | 'closed'; updatedAt: number }
const key = (wallet: string) => `buildpact_profile_${wallet}`;
export function loadProfile(wallet: string): BuilderProfile | null { try { const raw = localStorage.getItem(key(wallet)); return raw ? JSON.parse(raw) as BuilderProfile : null; } catch { return null; } }
export function saveProfile(profile: BuilderProfile): void { const next = { ...profile, updatedAt: Date.now() }; localStorage.setItem(key(profile.wallet), JSON.stringify(next)); }
export function hasProfile(wallet: string): boolean { return loadProfile(wallet) !== null; }
export const AVAILABILITY_META: Record<BuilderProfile['availability'], { emoji: string; label: string }> = { open: { emoji: '🟢', label: 'Disponible' }, busy: { emoji: '🟠', label: 'Occupé' }, closed: { emoji: '🔴', label: 'Indisponible' } };
