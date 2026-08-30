// src/components/ReorderableSection.tsx
// Petit wrapper : ajoute deux flèches ↑/↓ discrètes au-dessus d'un bloc,
// pour le réordonnancement de sections (voir useSectionOrder). Les
// flèches ne s'affichent que si le mouvement est possible dans ce sens.
import type { ReactNode } from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  children: ReactNode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function ReorderableSection({ children, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: Props) {
  const { t } = useLanguage();
  if (!canMoveUp && !canMoveDown) return <>{children}</>;
  return (
    <div className="group relative">
      <div className="pointer-events-none absolute -top-2 right-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {canMoveUp && (
          <button
            type="button"
            onClick={onMoveUp}
            aria-label={t('common.moveUp')}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-canvas-800 text-[11px] text-ink-300 shadow transition hover:text-white"
          >
            ↑
          </button>
        )}
        {canMoveDown && (
          <button
            type="button"
            onClick={onMoveDown}
            aria-label={t('common.moveDown')}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-canvas-800 text-[11px] text-ink-300 shadow transition hover:text-white"
          >
            ↓
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export default ReorderableSection;
