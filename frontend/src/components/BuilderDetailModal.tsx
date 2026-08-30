// src/components/BuilderDetailModal.tsx
// ═══════════════════════════════════════════════════════════════════
// Fiche détaillée d'un builder — ouverte au clic sur une carte de
// l'annuaire (/builders). Contrairement à la carte compacte (bio tronquée,
// 5 compétences max), ici tout est affiché : bio complète, toutes les
// compétences + niveau, tous les liens, wallet complet, note détaillée.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ALL_ROLES } from '../lib/roles';
import type { BuilderProfile } from '../lib/profile';
import { AVAILABILITY_META, SKILL_LEVEL_META } from '../lib/profile';
import { formatAddress } from '../lib/pacts';
import type { RatingSummary } from '../lib/contact';
import { fetchPostsByWallet, type NetworkPost } from '../lib/network';
import { fetchWalletChronicle, type ChronicleEntry } from '../lib/gamification';
import StarRating from './StarRating';
import { useLanguage } from '../lib/i18n/LanguageContext';

function roleLabel(id: string): string {
  return ALL_ROLES.find((r) => r.id === id)?.label ?? id;
}

// Mêmes libellés/emoji que l'onglet Chronique de QuestBoard.tsx — dupliqués
// ici à dessein plutôt qu'extraits en commun, pour ne pas toucher un
// composant déjà en place et testé (QuestBoard) dans le cadre de cet ajout.
const CHRONICLE_LABEL_KEY: Record<string, string> = {
  create: 'gamification.chronicleCreate',
  approve: 'gamification.chronicleApprove',
  fund: 'gamification.chronicleFund',
  finalize: 'gamification.chronicleFinalize',
  distribute: 'gamification.chronicleDistribute',
  add_member: 'gamification.chronicleAddMember',
};
const CHRONICLE_EMOJI: Record<string, string> = {
  create: '🌱',
  approve: '🤝',
  fund: '💰',
  finalize: '🏁',
  distribute: '🎁',
  add_member: '➕',
};

interface Props {
  profile: BuilderProfile;
  rating?: RatingSummary;
  canContact: boolean;
  onClose: () => void;
  onContact: () => void;
}

export default function BuilderDetailModal({ profile, rating, canContact, onClose, onContact }: Props) {
  const { t, lang } = useLanguage();
  const linkEntries = Object.entries(profile.links).filter(([, v]) => v && v.trim() !== '');

  // Activité du builder — posts Réseau + chronique de pacts (29/08, soir).
  // Chargée à l'ouverture de LA fiche courante uniquement (dépend de
  // profile.wallet), pas au montage du composant hôte (BuildersPage), pour
  // ne pas fetcher l'activité de tout l'annuaire d'un coup.
  const [activityTab, setActivityTab] = useState<'posts' | 'chronicle'>('posts');
  const [posts, setPosts] = useState<NetworkPost[] | null>(null);
  const [chronicle, setChronicle] = useState<ChronicleEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    setChronicle(null);
    fetchPostsByWallet(profile.wallet).then((p) => {
      if (!cancelled) setPosts(p);
    });
    fetchWalletChronicle(profile.wallet, 20).then((c) => {
      if (!cancelled) setChronicle(c);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.wallet]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/30">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-ink-500">
                  {profile.pseudo.trim().charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold text-white">{profile.pseudo}</h2>
              <span className="mt-0.5 inline-block rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-ink-400">
                {AVAILABILITY_META[profile.availability].emoji} {t(AVAILABILITY_META[profile.availability].labelKey)}
              </span>
              {rating && rating.ratingCount > 0 && (
                <div className="mt-1.5">
                  <StarRating value={rating.avgStars} count={rating.ratingCount} />
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="shrink-0 text-lg text-ink-400 hover:text-white">
            ×
          </button>
        </div>

        {profile.bio && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">{profile.bio}</p>
        )}

        {profile.skills.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-white">{t('profile.skills')}</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-accent-violet/30 bg-violet-500/10 px-2.5 py-1 text-xs text-white"
                >
                  {roleLabel(id)}
                  {profile.skillLevels[id] && (
                    <span className="text-ink-400"> · {t(SKILL_LEVEL_META[profile.skillLevels[id]].labelKey)}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {linkEntries.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-white">{t('profile.links')}</p>
            <ul className="space-y-1">
              {linkEntries.map(([k, v]) => (
                <li key={k} className="truncate text-xs text-ink-300">
                  <span className="text-ink-500">{k} :</span> {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          {/* Onglets Posts/Chronique (29/08, soir) — activité publique du
              builder, en lecture seule ici (réagir/commenter reste sur le
              fil #/network lui-même, pas dupliqué dans cette fiche). */}
          <div role="tablist" className="mb-2 flex gap-1 border-b border-white/10">
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'posts'}
              onClick={() => setActivityTab('posts')}
              className={
                'px-2.5 py-1.5 text-[11px] font-medium transition ' +
                (activityTab === 'posts' ? 'border-b-2 border-accent-violet text-white' : 'text-ink-400 hover:text-white')
              }
            >
              {t('builders.detailActivityPosts')} {posts && posts.length > 0 ? `(${posts.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'chronicle'}
              onClick={() => setActivityTab('chronicle')}
              className={
                'px-2.5 py-1.5 text-[11px] font-medium transition ' +
                (activityTab === 'chronicle' ? 'border-b-2 border-accent-violet text-white' : 'text-ink-400 hover:text-white')
              }
            >
              {t('builders.detailActivityChronicle')} {chronicle && chronicle.length > 0 ? `(${chronicle.length})` : ''}
            </button>
          </div>

          {activityTab === 'posts' ? (
            posts === null ? (
              <p className="text-[11px] text-ink-500">{t('builders.detailLoadingActivity')}</p>
            ) : posts.length === 0 ? (
              <p className="text-[11px] text-ink-500">{t('builders.detailNoPosts')}</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {posts.map((p) => (
                  <li key={p.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-200">{p.body}</p>
                    <span className="mt-1 block text-[10px] text-ink-500">
                      {new Date(p.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : chronicle === null ? (
            <p className="text-[11px] text-ink-500">{t('builders.detailLoadingActivity')}</p>
          ) : chronicle.length === 0 ? (
            <p className="text-[11px] text-ink-500">{t('builders.detailNoChronicle')}</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {chronicle.map((e, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px]"
                >
                  <span className="inline-flex items-center gap-2 text-ink-200">
                    <span aria-hidden="true">{CHRONICLE_EMOJI[e.kind] ?? '•'}</span>
                    {t(CHRONICLE_LABEL_KEY[e.kind] ?? e.kind)}
                    {e.amountSol !== null && (
                      <span className="font-mono text-accent-neon">{e.amountSol.toFixed(2)} SOL</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-ink-500">
                    {new Date(e.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-white">{t('builders.detailWallet')}</p>
          {/* Confidentialité du profil (29/08, soir suivant) — masque le wallet complet à l'affichage si le builder l'a demandé. Ne change rien on-chain, seulement ce rendu. */}
          <p className="break-all font-mono text-[10px] text-ink-500">
            {profile.hideWallet ? formatAddress(profile.wallet) : profile.wallet}
          </p>
        </div>

        {canContact && profile.availability === 'open' && (
          <button
            type="button"
            onClick={onContact}
            className="w-full rounded-lg bg-accent-violet py-2.5 text-sm font-medium text-ink-900 transition hover:bg-accent-violet/90"
          >
            {t('builders.contactButton')}
          </button>
        )}
      </div>
    </div>
  );
}
