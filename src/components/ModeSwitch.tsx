// src/components/ModeSwitch.tsx
// ═══════════════════════════════════════════════════════════════════
// Sélecteur clair/sombre — indépendant de ThemeSwitch (qui choisit la
// palette d'accent). Même schéma que les autres switches : local et
// instantané, persisté par wallet via ThemeContext.
// ═══════════════════════════════════════════════════════════════════
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function ModeSwitch({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  const { t } = useLanguage();
  const isLight = mode === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={t('theme.modeAria')}
      title={isLight ? t('theme.modeLight') : t('theme.modeDark')}
      onClick={() => setMode(isLight ? 'dark' : 'light')}
      className={
        'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs font-medium text-ink-200 transition hover:border-accent-violet/40 hover:text-white ' +
        (compact ? 'h-9' : 'h-11')
      }
    >
      <span aria-hidden="true">{isLight ? '☀️' : '🌙'}</span>
      <span>{isLight ? t('theme.modeLight') : t('theme.modeDark')}</span>
    </button>
  );
}

export default ModeSwitch;
