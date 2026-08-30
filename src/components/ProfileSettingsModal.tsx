// src/components/ProfileSettingsModal.tsx
// ═══════════════════════════════════════════════════════════════════
// Pop-up de paramètres — palette d'accent, mode clair/sombre, langue.
// Extrait de MonProfilPage pour être montable depuis n'importe quelle
// page (ex. Leaderboard) sans dupliquer la logique de sauvegarde.
//
// Deux façons d'être utilisé :
//  1) Avec `profile` fourni (page Profil) : le brouillon en cours
//     (pseudo/bio non sauvegardés inclus) est enregistré EN MÊME TEMPS
//     que le thème — une seule signature couvre tout, comme avant
//     l'extraction.
//  2) Sans `profile` (ex. Leaderboard) : le modal va chercher lui-même
//     le profil distant du wallet connecté juste avant d'enregistrer,
//     pour ne modifier QUE le thème sans écraser le reste avec un objet
//     vide. Voir le bug déjà rencontré une fois sur ce projet : omettre
//     bannerUrl/themePalette au save les efface silencieusement en base.
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { emptyProfile, type BuilderProfile } from '../lib/profile';
import { fetchProfile, submitProfileUpdate } from '../lib/profileRemote';
import MockupPreviewFrame from './MockupPreviewFrame';
import CustomRpcSettings from './CustomRpcSettings';
import DensitySwitch from './DensitySwitch';
import UsdToggleSettings from './UsdToggleSettings';
import CsvExportButton from './CsvExportButton';
import NotificationSettings from './NotificationSettings';
import ThemeModeGrid from './ThemeModeGrid';
import BackgroundSwitch from './BackgroundSwitch';
import ImagePreviewSettings from './ImagePreviewSettings';
import GlowStrengthSwitch from './GlowStrengthSwitch';
import LanguageSwitch from './LanguageSwitch';
import InfoTooltip from './InfoTooltip';

type SignFn = (message: Uint8Array) => Promise<Uint8Array>;
type SaveState = 'idle' | 'saving' | 'success' | 'error';

interface ProfileSettingsModalProps {
  onClose: () => void;
  /** Brouillon de profil de la page hôte, s'il y en a un (voir en-tête). */
  profile?: BuilderProfile | null;
  /** Appelé avec le profil effectivement enregistré, pour que la page
   *  hôte puisse mettre à jour son propre état (ex. setProfile/setSavedProfile). */
  onSaved?: (saved: BuilderProfile) => void;
}

export function ProfileSettingsModal({ onClose, profile, onSaved }: ProfileSettingsModalProps) {
  const { t } = useLanguage();
  const { theme, preview, confirmPreview, cancelPreview } = useTheme();
  const { publicKey, signMessage } = useWallet();
  const [saving, setSaving] = useState<SaveState>('idle');
  // Confidentialité (29/08, soir suivant) : n'a de sens que si on connaît
  // déjà le profil (cas `profile` fourni, page Profil) — sinon on ne sait
  // pas encore la valeur actuelle avant le fetch dans handleSave, et
  // l'écraser à `false` par défaut effacerait un `true` déjà enregistré.
  const [hideWallet, setHideWallet] = useState<boolean>(profile?.hideWallet ?? false);

  const canSave = !!publicKey && !!signMessage;

  // Fermer (croix ou clic sur le fond) sans avoir cliqué "Activer ce thème"
  // doit annuler l'aperçu en cours, pas le laisser collé à l'écran — sinon
  // l'app resterait visuellement sur un choix jamais validé.
  const handleClose = () => {
    cancelPreview();
    onClose();
  };

  const handleSave = async () => {
    if (!publicKey || !signMessage) return;
    setSaving('saving');
    const wallet = publicKey.toBase58();
    // Brouillon hôte s'il existe, sinon profil distant, sinon coquille vide
    // — jamais un objet partiel construit à la main ici (voir en-tête).
    const base = profile ?? (await fetchProfile(wallet)) ?? emptyProfile(wallet);
    // Cas sans `profile` fourni : on vient de fetch — `hideWallet` n'a pas pu
    // être réglé dans CETTE ouverture de la modale (le contrôle n'est même
    // pas affiché, voir plus bas), donc on garde la valeur déjà en base.
    const toSave: BuilderProfile = {
      ...base,
      themePalette: theme,
      hideWallet: profile ? hideWallet : base.hideWallet,
      wallet,
    };
    const r = await submitProfileUpdate(wallet, signMessage as SignFn, toSave);
    if ('error' in r) {
      setSaving('error');
      return;
    }
    setSaving('success');
    onSaved?.(toSave);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-8 sm:pt-14"
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.settingsTitle')}
      onClick={handleClose}
    >
      {/* 3e passe (30/08, nuit 2) — le plein écran total de la 2e passe
          était "trop grand, prend trop de place". Retour à une boîte
          bordée, mais légèrement plus large que la toute première version
          (`max-w-xl` → `max-w-2xl`) et ancrée en HAUT de la page plutôt que
          centrée verticalement (`items-start` + `pt-8`/`sm:pt-14` sur le
          conteneur, au lieu de `items-center`) — c'est la disposition
          explicitement demandée. `max-h-[85vh]` + `overflow-y-auto` sur le
          panneau : le contenu (nombreux réglages) reste scrollable sans
          repousser le panneau hors de l'écran sur les petits écrans. */}
      <div
        className="modal-surface my-4 flex max-h-[85vh] w-full max-w-2xl flex-col space-y-5 overflow-y-auto rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-base font-bold text-white">{t('profile.settingsTitle')}</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('profile.settingsClose')}
            className="text-ink-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        <div>
          {/* Cadre d'aperçu contenu (téléphone/navigateur) — lit
              ThemeContext.preview et le rend dans ce cadre uniquement,
              jamais sur la vraie page (voir ThemeContext.tsx et
              DashboardLayout.tsx). Placé au-dessus des sélecteurs pour
              qu'il soit visible sans scroll pendant qu'on clique palette/
              mode/fond juste en dessous. */}
          <MockupPreviewFrame />
        </div>

        <div>
          {/* Fusion palette + mode (29/08) : 6 combinaisons en un seul clic
              au lieu de 2 contrôles à combiner mentalement (ThemeSwitch +
              ModeSwitch restent utilisés ailleurs, ex. en-tête compacte). */}
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
            {t('profile.settingsThemeLabel')}
            <InfoTooltip text={t('profile.settingsThemeHint')} />
          </p>
          <div className="mt-2">
            <ThemeModeGrid />
          </div>
        </div>

        <div>
          <BackgroundSwitch />
        </div>

        {/* Barre d'aperçu — juste sous "Fond de page" (30/08, 2e essai : le
            sticky-top précédent ne convenait pas). ThemeModeGrid ET
            BackgroundSwitch posent tous les deux ThemeContext.preview, donc
            la barre reste pertinente ici pour les deux — mais elle est
            désormais directement accolée aux fonds plutôt qu'accrochée en
            haut de la modale. "Annuler" revient à l'état déjà validé
            (aucune sauvegarde), "Activer ce thème" applique et persiste
            (voir confirmPreview dans ThemeContext.tsx) — indépendant du
            bouton "Enregistrer" plus bas, qui ne synchronise que vers le
            profil distant pour les autres appareils. */}
        {preview && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-violet/30 bg-accent-violet/10 px-3 py-2.5">
            <p className="text-[11px] leading-tight text-ink-200">{t('theme.previewBanner')}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={cancelPreview}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 transition hover:text-white"
              >
                {t('theme.previewCancel')}
              </button>
              <button
                type="button"
                onClick={confirmPreview}
                className="rounded-md bg-accent-violet/90 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent-violet"
              >
                {t('theme.previewConfirm')}
              </button>
            </div>
          </div>
        )}

        <div>
          <ImagePreviewSettings />
        </div>

        <div>
          <GlowStrengthSwitch />
        </div>

        <div className="space-y-4 border-t border-white/10 pt-4">
          <DensitySwitch />
          <NotificationSettings />
          {profile && (
            <div>
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-white">
                {t('settings.privacyHeading')}
                <InfoTooltip text={t('settings.privacyHint')} />
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-medium text-ink-200">
                <input
                  type="checkbox"
                  checked={hideWallet}
                  onChange={(e) => setHideWallet(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-black/30 accent-accent-violet"
                />
                {t('settings.privacyToggleLabel')}
              </label>
            </div>
          )}
          <CustomRpcSettings />
          <UsdToggleSettings />
          <CsvExportButton />
        </div>

        <div>
          <p className="text-xs font-semibold text-white">{t('profile.settingsLangLabel')}</p>
          <div className="mt-2">
            <LanguageSwitch />
          </div>
        </div>

        {canSave && (
          <button
            type="button"
            disabled={saving === 'saving'}
            onClick={handleSave}
            className="w-full rounded-lg bg-accent-violet/90 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-violet disabled:opacity-60"
          >
            {saving === 'saving' ? t('profile.saving') : t('profile.settingsSave')}
          </button>
        )}
        {saving === 'success' && (
          <p className="text-center text-xs text-emerald-400">{t('profile.settingsSaved')}</p>
        )}
        {saving === 'error' && (
          <p className="text-center text-xs text-rose-400">{t('profile.saveErrorPrefix')}</p>
        )}
      </div>
    </div>
  );
}

export default ProfileSettingsModal;
