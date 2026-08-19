import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AVAILABILITY_META, loadProfile, saveProfile } from '../lib/profile';
import type { BuilderProfile } from '../lib/profile';
import { fetchProfile, upsertProfile, isRemoteEnabled } from '../lib/profileRemote';
import { ROLE_GROUPS } from '../lib/roles';

const inputCls = 'w-full rounded border border-white/10 bg-base-800 p-2 text-white';
const emptyProfile = (wallet: string): BuilderProfile => ({ wallet, pseudo: '', bio: '', skills: [], links: {}, availability: 'open', updatedAt: 0 });

type SyncState = 'idle' | 'saving' | 'cloud' | 'local-only';

export default function MonProfilPage() {
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<BuilderProfile | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');

  // Chargement : Supabase d'abord, fallback localStorage
  useEffect(() => {
    if (!publicKey) { setProfile(null); return; }
    const wallet = publicKey.toBase58();
    setSync('idle');
    let cancelled = false;
    (async () => {
      const remote = await fetchProfile(wallet);
      if (cancelled) return;
      setProfile(remote ?? loadProfile(wallet) ?? emptyProfile(wallet));
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  if (!publicKey || !profile) return <p className="text-ink-300">Connectez votre wallet</p>;

  const update = (patch: Partial<BuilderProfile>) => { setProfile(prev => prev ? { ...prev, ...patch } : prev); setSync('idle'); };
  const toggleSkill = (id: string) => update({ skills: profile.skills.includes(id) ? profile.skills.filter(x => x !== id) : [...profile.skills, id] });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile.pseudo.trim() || profile.skills.length < 1) return;
    setSync('saving');
    const toSave = { ...profile, wallet: publicKey.toBase58(), updatedAt: Date.now() };
    saveProfile(toSave); // localStorage toujours (cache offline)
    const ok = await upsertProfile(toSave);
    setSync(ok ? 'cloud' : 'local-only');
  };

  return <main className="glass-panel space-y-5 p-5"><div><h1 className="text-xl font-bold text-white">Mon profil Builder</h1><p className="mt-1 text-sm text-ink-400">Présente tes compétences aux futurs membres de pact.</p></div><form className="space-y-4" onSubmit={save}><label className="block text-xs font-semibold text-white">Pseudo<input className={inputCls} maxLength={24} value={profile.pseudo} onChange={e => update({ pseudo: e.target.value })} /></label><label className="block text-xs font-semibold text-white">Bio<textarea className={inputCls} rows={4} maxLength={280} value={profile.bio} onChange={e => update({ bio: e.target.value })} /><span className="text-[11px] text-ink-400">{profile.bio.length}/280</span></label><div><p className="text-xs font-semibold text-white">Compétences</p>{ROLE_GROUPS.map(group => <div className="mt-2" key={group.category}><p className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">{group.category}</p><div className="flex flex-wrap gap-2">{group.roles.map(role => <button type="button" key={role.id} onClick={() => toggleSkill(role.id)} className={`rounded-full border px-3 py-1 text-xs ${profile.skills.includes(role.id) ? 'border-accent-violet/60 bg-violet-500/20 text-white' : 'border-white/10 text-ink-300'}`}>{role.label}</button>)}</div></div>)}{profile.skills.length < 1 && <p className="mt-1 text-[11px] text-red-400">Sélectionne au moins une compétence.</p>}</div><div><p className="text-xs font-semibold text-white">Liens</p><div className="mt-2 space-y-2">{(['github', 'twitter', 'portfolio'] as const).map(link => <input key={link} className={inputCls} placeholder={link} type="url" value={profile.links[link] ?? ''} onChange={e => update({ links: { ...profile.links, [link]: e.target.value } })} />)}</div></div><div><p className="text-xs font-semibold text-white">Disponibilité</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{(Object.entries(AVAILABILITY_META) as Array<[BuilderProfile['availability'], { emoji: string; label: string }]>).map(([id, meta]) => <button type="button" key={id} onClick={() => update({ availability: id })} className={`rounded border px-3 py-2 text-xs ${profile.availability === id ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-white/10 text-ink-300'}`}>{meta.emoji} {meta.label}</button>)}</div></div><button className="w-full rounded bg-accent-neon py-2 font-bold text-ink-900 disabled:opacity-50" type="submit" disabled={sync === 'saving'}>{sync === 'saving' ? 'Enregistrement…' : 'Enregistrer mon profil'}</button>{sync === 'cloud' && <p className="text-sm text-emerald-300">☁️ Profil enregistré et synchronisé cloud</p>}{sync === 'local-only' && <p className="text-sm text-amber-300">💾 Enregistré en local uniquement {isRemoteEnabled ? '(erreur Supabase — vérifie la console)' : '(Supabase non configuré)'}</p>}</form></main>;
}
