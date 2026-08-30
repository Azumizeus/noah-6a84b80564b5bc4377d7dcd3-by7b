// src/components/ImagePreviewSettings.tsx
// ═══════════════════════════════════════════════════════════════════
// Réglages de l'aperçu grand format (logo/bannière, ImageHoverPreview) :
// activer/désactiver complètement, et choisir le déclencheur (survol ou
// clic). Le sélecteur de déclencheur est visuellement désactivé (pas
// retiré du DOM) quand l'aperçu est éteint, pour ne pas faire sauter le
// layout au toggle.
// ═══════════════════════════════════════════════════════════════════
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/i18n/LanguageContext';
import InfoTooltip from './InfoTooltip';

export function ImagePreviewSettings() {
  const { previewEnabled, setPreviewEnabled } = useTheme();
  const { t } = useLanguage();

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white">
        {t('theme.previewHeading')}
        <InfoTooltip text={t('theme.previewHint')} />
      </h4>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
        <span className="text-xs text-ink-200">{t('theme.previewToggleLabel')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={previewEnabled}
          onClick={() => setPreviewEnabled(!previewEnabled)}
          className={
            'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
            (previewEnabled ? 'bg-accent-violet' : 'bg-white/15')
          }
        >
          <span
            aria-hidden="true"
            className={
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ' +
              (previewEnabled ? 'translate-x-[22px]' : 'translate-x-0.5')
            }
          />
        </button>
      </label>
    </div>
  );
}

export default ImagePreviewSettings;
