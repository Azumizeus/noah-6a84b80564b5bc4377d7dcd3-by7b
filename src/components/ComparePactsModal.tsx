// src/components/ComparePactsModal.tsx
// ═══════════════════════════════════════════════════════════════════
// Comparateur de pacts (29/08, nuit) — 2 à 3 pacts sélectionnés sur la
// Marketplace, mis côte à côte : parts, coffre, membres. Lecture seule,
// aucune action on-chain ici (mêmes liens "Voir la fiche" que la card).
// ═══════════════════════════════════════════════════════════════════
import type { ChainPact } from '../lib/pacts';
import { formatAddress, formatSol } from '../lib/pacts';
import { MAX_MEMBERS } from '../lib/constants';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  pacts: ChainPact[];
  openRoles: Map<string, string[]>;
  onClose: () => void;
}

export default function ComparePactsModal({ pacts, openRoles, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="modal-surface max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-sans text-lg font-bold text-white">{t('compare.modalTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-ink-300 transition hover:text-white"
          >
            {t('compare.close')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr>
                <th className="w-28 border-b border-white/10 pb-2 pr-3 text-[11px] font-medium text-ink-500">
                  {t('compare.colField')}
                </th>
                {pacts.map((p) => (
                  <th key={p.pda.toBase58()} className="border-b border-white/10 px-3 pb-2 align-top">
                    <p className="line-clamp-2 text-sm font-semibold text-white">{p.title}</p>
                    <a
                      href={`#/pact/${p.pda.toBase58()}`}
                      className="mt-1 inline-block text-[11px] text-accent-neon hover:underline"
                    >
                      {t('compare.viewSheet')}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="align-top">
              <CompareRow label={t('compare.rowStatus')}>
                {pacts.map((p) => (
                  <td key={p.pda.toBase58()} className="px-3 py-2.5 text-ink-200">
                    {p.status === 'active' ? t('marketplaceCard.funding') : t('marketplaceCard.recruiting')}
                  </td>
                ))}
              </CompareRow>

              <CompareRow label={t('compare.rowVault')}>
                {pacts.map((p) => (
                  <td key={p.pda.toBase58()} className="px-3 py-2.5 font-mono font-bold text-white">
                    {formatSol(p.vaultBalanceSol)} SOL
                  </td>
                ))}
              </CompareRow>

              <CompareRow label={t('compare.rowMembers')}>
                {pacts.map((p) => (
                  <td key={p.pda.toBase58()} className="px-3 py-2.5 font-mono text-white">
                    {p.members.length} / {MAX_MEMBERS}
                  </td>
                ))}
              </CompareRow>

              <CompareRow label={t('compare.rowSlotsLeft')}>
                {pacts.map((p) => (
                  <td key={p.pda.toBase58()} className="px-3 py-2.5 font-mono text-accent-neon">
                    {Math.max(0, MAX_MEMBERS - p.members.length)}
                  </td>
                ))}
              </CompareRow>

              <CompareRow label={t('compare.rowAllocated')}>
                {pacts.map((p) => {
                  const pct = p.members.reduce((sum, m) => sum + m.shareBps, 0) / 100;
                  return (
                    <td key={p.pda.toBase58()} className="px-3 py-2.5">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-accent-violet"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="mt-1 block text-[11px] text-ink-400">{pct.toFixed(0)}%</span>
                    </td>
                  );
                })}
              </CompareRow>

              <CompareRow label={t('compare.rowSkills')}>
                {pacts.map((p) => {
                  const skills = openRoles.get(p.pda.toBase58()) ?? [];
                  return (
                    <td key={p.pda.toBase58()} className="px-3 py-2.5 text-ink-300">
                      {skills.length > 0 ? skills.join(' · ') : t('compare.noneValue')}
                    </td>
                  );
                })}
              </CompareRow>

              <CompareRow label={t('compare.rowCreator')}>
                {pacts.map((p) => (
                  <td key={p.pda.toBase58()} className="px-3 py-2.5 font-mono text-ink-400">
                    {formatAddress(p.creator.toBase58())}
                  </td>
                ))}
              </CompareRow>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompareRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="border-b border-white/5 py-2.5 pr-3 text-[11px] font-medium text-ink-500">{label}</td>
      {children}
    </tr>
  );
}
