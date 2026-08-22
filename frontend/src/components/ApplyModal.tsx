// src/components/ApplyModal.tsx
// ═══════════════════════════════════════════════════════════════════
// "Postuler" à un pact ouvert — 100% off-chain (Supabase). Le programme
// Anchor n'a pas d'instruction de candidature (add_member est
// founder-only) ; le founder voit les candidatures et décide lui-même
// d'ajouter le membre on-chain via add_member. Voir lib/applications.ts.
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ROLE_GROUPS } from '../lib/roles';
import { submitApplication, applicationsEnabled } from '../lib/applications';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  projectPda: string;
  projectTitle: string;
  onClose: () => void;
}

export default function ApplyModal({ projectPda, projectTitle, onClose }: Props) {
  const { publicKey } = useWallet();
  const { t } = useLanguage();
  const [roleId, setRoleId] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const roleWanted =
    roleId === 'custom'
      ? customRole.trim()
      : (ROLE_GROUPS.flatMap((g) => g.roles).find((r) => r.id === roleId)?.label ?? '');

  const handleSubmit = async () => {
    if (!publicKey) {
      setError(t('apply.errorConnect'));
      return;
    }
    if (!roleWanted) {
      setError(t('apply.errorRole'));
      return;
    }
    setLoading(true);
    setError(null);
    const ok = await submitApplication({
      projectPda,
      roleWanted,
      applicantWallet: publicKey.toBase58(),
      message: message.trim(),
    });
    setLoading(false);
    if (ok) {
      setSent(true);
    } else {
      setError(t('apply.errorSubmit'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d15] border border-purple-500/30 rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">{t('apply.title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t('apply.close')}>✕</button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          {t('apply.project')} <span className="text-purple-400">{projectTitle}</span>
        </p>

        {!applicationsEnabled ? (
          <p className="text-sm text-amber-400">
            {t('apply.disabled')}
          </p>
        ) : sent ? (
          <div className="bg-accent-neon/10 border border-accent-neon/30 rounded-lg p-4">
            <p className="text-sm font-semibold text-accent-neon">{t('apply.sentTitle')}</p>
            <p className="mt-1 text-xs text-gray-400">
              {t('apply.sentBody')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              {t('apply.close')}
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="apply-role" className="mb-1 block text-xs text-gray-400">
              {t('apply.roleLabel')}
            </label>
            <select
              id="apply-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="mb-3 w-full rounded-lg border border-purple-500/30 bg-black/50 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="" disabled>{t('apply.rolePlaceholder')}</option>
              {ROLE_GROUPS.map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">{t('apply.roleOther')}</option>
            </select>

            {roleId === 'custom' && (
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder={t('apply.customRolePlaceholder')}
                className="mb-3 w-full rounded-lg border border-purple-500/30 bg-black/50 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              />
            )}

            <label htmlFor="apply-message" className="mb-1 block text-xs text-gray-400">
              {t('apply.messageLabel')}
            </label>
            <textarea
              id="apply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 400))}
              rows={4}
              placeholder={t('apply.messagePlaceholder')}
              className="mb-1 w-full resize-none rounded-lg border border-purple-500/30 bg-black/50 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
            <p className="mb-3 text-right text-[11px] text-gray-500">{message.length}/400</p>

            {!publicKey && (
              <p className="mb-3 text-[11px] text-amber-400">
                {t('apply.connectWarning')}
              </p>
            )}

            {error && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg bg-gray-700 py-2 text-sm font-medium text-white hover:bg-gray-600"
                disabled={loading}
              >
                {t('apply.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !publicKey}
                className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
              >
                {loading ? t('apply.sending') : t('apply.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
