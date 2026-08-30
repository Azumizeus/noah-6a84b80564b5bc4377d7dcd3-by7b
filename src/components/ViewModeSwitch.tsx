// src/components/ViewModeSwitch.tsx
// ═══════════════════════════════════════════════════════════════════
// Sélecteur liste / grille / vignettes — 3 boutons icône, même endroit
// sur Pacts et Marketplace (30/08). Voir hooks/useViewMode.ts.
// ═══════════════════════════════════════════════════════════════════
import type { ReactElement } from 'react';
import type { ViewMode } from '../lib/viewMode';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

const OPTIONS: { id: ViewMode; labelKey: string }[] = [
  { id: 'list', labelKey: 'common.viewList' },
  { id: 'grid', labelKey: 'common.viewGrid' },
  { id: 'compact', labelKey: 'common.viewCompact' },
];

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function CompactIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={1 + (i % 3) * 5} y={1 + Math.floor(i / 3) * 5} width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      ))}
    </svg>
  );
}
const ICONS: Record<ViewMode, () => ReactElement> = { list: ListIcon, grid: GridIcon, compact: CompactIcon };

export function ViewModeSwitch({ value, onChange }: Props) {
  const { t } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t('common.viewModeAria')} className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
      {OPTIONS.map((opt) => {
        const Icon = ICONS[opt.id];
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(opt.labelKey)}
            title={t(opt.labelKey)}
            onClick={() => onChange(opt.id)}
            className={
              'flex h-7 w-7 items-center justify-center rounded-md transition ' +
              (active ? 'bg-accent-violet/25 text-white' : 'text-ink-400 hover:text-white')
            }
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

export default ViewModeSwitch;
