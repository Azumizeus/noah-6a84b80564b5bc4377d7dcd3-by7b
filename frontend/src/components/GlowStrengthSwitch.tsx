// src/components/GlowStrengthSwitch.tsx
// ═══════════════════════════════════════════════════════════════════
// Curseur d'intensité des halos (0 / 0.5 / 1) — préférence d'appareil
// (comme l'aperçu image), pas liée au wallet : c'est un réglage de
// confort visuel/perf, pas d'identité. Consommé par --glow-strength
// dans index.css, qui multiplie l'alpha des box-shadow existants
// (.btn-primary:hover, .btn-neon:hover, .card-lift:hover, jauges XP,
// barres d'allocation…) — voir ThemeContext.tsx pour l'application.
// ═══════════════════════════════════════════════════════════════════
import { useTheme } from '../lib/ThemeContext';
import type { GlowStrength } from '../lib/theme';
import { useLanguage } from '../lib/i18n/LanguageContext';
import InfoTooltip from './InfoTooltip';

const OPTIONS: { value: GlowStrength; labelKey: string }[] = [
  { value: 0, labelKey: 'theme.glowOff' },
  { value: 0.5, labelKey: 'theme.glowMedium' },
  { value: 1, labelKey: 'theme.glowFull' },
];

export function GlowStrengthSwitch() {
  const { glowStrength, setGlowStrength } = useTheme();
  const { t } = useLanguage();

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
        {t('theme.glowHeading')}
        <InfoTooltip text={t('theme.glowHint')} />
      </p>
      <div role="radiogroup" aria-label={t('theme.glowHeading')} className="mt-2 grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = glowStrength === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setGlowStrength(opt.value)}
              className={
                'rounded-lg border px-2 py-2 text-[11px] font-medium transition ' +
                (active
                  ? 'border-accent-violet/50 bg-white/[0.06] text-white'
                  : 'border-white/10 bg-black/20 text-ink-400 hover:border-white/20 hover:text-ink-200')
              }
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GlowStrengthSwitch;
