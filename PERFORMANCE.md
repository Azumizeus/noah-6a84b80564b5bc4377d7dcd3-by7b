// PERFORMANCE.md
# Performance Notes — BuildPact Dashboard

## Bundle impact (gzip)
| Module | Estim. gzip |
|---|---|
| react + react-dom (18.x) | ~45 KB |
| framer-motion 11 (tree-shaken) | ~50 KB |
| tailwind purgé (composants utilisés) | ~10 KB |
| App-specific (DashboardPage + 5 composants) | ~18 KB |
| **Total** | **~123 KB** ✅ < 150 KB |

Aucune image externe : 100% SVG inline (logo, orbes via `radial-gradient`, icônes). Aucun runtime client externe hormis Google Fonts (CSS + 2 woff2, ~30 KB — préconnect + `font-display: swap`).

## LCP < 800ms
- `font-display: swap` évite le FOIT ; le LCP (`<h1>`) s'affiche en police système fallback puis swap instantané.
- Orbes et grille d'arrière-plan en pur CSS (radial-gradient + mask) — zéro coût réseau, GPU-composé.
- Pas de parallaxe, pas de `position: sticky` coûteux, pas d'images hero.
- Critical CSS inlinable via Vite `@vitejs/plugin-critical` si requis.

## Lazy loading strategy
- **Routes** : `React.lazy(() => import('./pages/DashboardPage'))` au routeur, Suspense fallback = squelette `.skeleton`.
- **WalletButton dropdown** : monté via `AnimatePresence` uniquement quand `open === true` — zéro coût initial.
- **PactCard** : `React.memo` recommandé en production (props stables) ; le `whileHover` est GPU-only (transform).
- **StatsCard count-up** : un seul `requestAnimationFrame` par carte, cancel sur unmount.
- **Polices** : self-host via `@fontsource/space-grotesk` + `@fontsource/space-mono` pour supprimer le round-trip Google.

## Animations 60fps
- Toutes les animations Framer n'utilisent que `opacity` + `transform` (composés GPU, pas de layout/paint).
- `MotionConfig reducedMotion="user"` désactive globalement les transformations pour les sensibilités vestibulaires.
- `@media (prefers-reduced-motion: reduce)` coupe résiduel CSS (shimmer, float, pulse-ring).
