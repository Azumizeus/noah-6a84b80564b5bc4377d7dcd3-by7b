// src/components/FreeGrid.tsx
// ═══════════════════════════════════════════════════════════════════
// Grille libre — glisser-déposer ET redimensionnement au pixel, via
// react-grid-layout (sous-chemin /legacy : API v1 stable, flat props,
// plutôt que la nouvelle API v2 à base de hooks — moins de surface de
// risque pour un ajout ponctuel). Remplace, pour le dashboard profil
// UNIQUEMENT (demande explicite, 29/08 nuit — "je veux une vraie grille
// libre avec redimensionnement au pixel pour dashboard profil"), le
// réordonnancement par flèches (ReorderableSection/useSectionOrder,
// resté en place ailleurs : page Pact, Marketplace).
//
// Layout persisté en localStorage, scopé par (pageKey, wallet) comme
// useSectionOrder — même clé de wallet, format différent (x/y/w/h par
// bloc plutôt qu'un simple ordre).
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useState, type ReactNode } from 'react';
import { WidthProvider, Responsive, type LayoutItem, type Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface FreeGridItem {
  id: string;
  content: ReactNode;
  /** Position/taille par défaut si rien n'est encore persisté — en unités
   *  de grille (12 colonnes), pas en pixels. */
  defaultLayout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
}

interface Props {
  pageKey: string;
  wallet: string | null;
  items: FreeGridItem[];
  /** Hauteur d'une unité de rangée en px — react-grid-layout calcule les
   *  hauteurs de bloc en multipliant `h` (unités) par cette valeur. */
  rowHeight?: number;
}

function storageKey(pageKey: string, wallet: string | null): string {
  return wallet ? `buildpact_free_grid_${pageKey}_${wallet}` : `buildpact_free_grid_${pageKey}`;
}

function loadLayout(pageKey: string, wallet: string | null, items: FreeGridItem[]): LayoutItem[] {
  try {
    const raw = localStorage.getItem(storageKey(pageKey, wallet));
    if (raw) {
      const parsed = JSON.parse(raw) as LayoutItem[];
      const known = new Set(items.map((it) => it.id));
      const kept = parsed.filter((l) => known.has(l.i));
      const missingIds = items.map((it) => it.id).filter((id) => !kept.some((l) => l.i === id));
      if (missingIds.length === 0) return kept;
      // Bloc ajouté depuis la dernière sauvegarde (nouvelle version de
      // l'app) : on l'ajoute à la fin plutôt que de perdre tout le layout
      // déjà personnalisé par l'utilisateur.
      const extra = items
        .filter((it) => missingIds.includes(it.id))
        .map((it, i) => ({ i: it.id, x: 0, y: 1000 + i, w: it.defaultLayout.w, h: it.defaultLayout.h }));
      return [...kept, ...extra];
    }
  } catch {
    /* retombe sur le layout par défaut */
  }
  return items.map((it) => ({ i: it.id, ...it.defaultLayout }));
}

function saveLayout(pageKey: string, wallet: string | null, layout: LayoutItem[]): void {
  try {
    localStorage.setItem(storageKey(pageKey, wallet), JSON.stringify(layout));
  } catch {
    /* non bloquant */
  }
}

export function FreeGrid({ pageKey, wallet, items, rowHeight = 32 }: Props) {
  const [layout, setLayout] = useState<LayoutItem[]>(() => loadLayout(pageKey, wallet, items));
  // Breakpoint actif — voir le commentaire sur handleLayoutChange plus bas.
  const [breakpoint, setBreakpoint] = useState<string>('lg');

  // 30/08, 2 passes :
  //  1re passe (bug initial) : sur un breakpoint étroit (mobile, ou le
  //  tout premier rendu avant mesure de largeur), react-grid-layout génère
  //  un layout 'sm' à partir des tailles PAR DÉFAUT, sauvegardé par erreur
  //  sous la même clé que le layout 'lg' personnalisé — écrasement
  //  silencieux.
  //  2e passe (régression introduite par le 1er correctif) : lire
  //  `layouts.lg` au lieu du `layout` reçu cassait le drag EN DIRECT — RGL
  //  ne met à jour `layouts.lg` qu'À LA FIN d'un geste, donc pendant un
  //  glissé actif `layouts.lg` restait figé sur l'ancienne position et
  //  l'élément semblait revenir en place à chaque mouvement (plus aucun
  //  déplacement possible). Fix définitif : toujours utiliser le `layout`
  //  reçu tel quel pour l'AFFICHAGE (fluide, quel que soit le breakpoint),
  //  mais ne PERSISTER en localStorage que quand on est sur le breakpoint
  //  'lg' (suivi via onBreakpointChange) — le seul qui a un vrai sens pour
  //  une grille libre (le breakpoint 'sm' n'a qu'une colonne).
  const handleLayoutChange = useCallback(
    (current: Layout) => {
      const next = [...current];
      setLayout(next);
      if (breakpoint === 'lg') {
        saveLayout(pageKey, wallet, next);
      }
    },
    [pageKey, wallet, breakpoint]
  );

  return (
    <ResponsiveGridLayout
      className="free-grid"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 640, sm: 0 }}
      cols={{ lg: 12, sm: 1 }}
      rowHeight={rowHeight}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      draggableHandle=".free-grid-handle"
      onBreakpointChange={setBreakpoint}
      onLayoutChange={handleLayoutChange}
    >
      {items.map((it) => (
        <div key={it.id} data-grid={layout.find((l) => l.i === it.id)}>
          {/* Poignée de déplacement — évite qu'un clic sur un bouton/lien À
              L'INTÉRIEUR du bloc (ex. "Contacter") déclenche un drag à la
              place. Le redimensionnement (coin bas-droit) reste géré par
              react-grid-layout lui-même, indépendant de cette poignée. */}
          <div className="free-grid-handle flex cursor-move items-center justify-center gap-1 rounded-t-lg border-x border-t border-white/10 bg-black/30 py-1 text-[10px] text-ink-500">
            ⠿⠿
          </div>
          <div className="h-[calc(100%-22px)] overflow-y-auto rounded-b-lg border-x border-b border-white/10">
            {it.content}
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}

export default FreeGrid;
