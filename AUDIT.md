// AUDIT.md
# Accessibility Audit — BuildPact Dashboard

## Focus management
- **Skip link** : présent en haut du DOM (`#main-content`), visible au focus clavier uniquement.
- **Anneau focus** : 2px plein `#14F195` (neon) + offset 2px, défini globalement via `:focus-visible`. Toutes les cibles tactiles ≥ 44×44px.
- **Fermeture clavier** : dropdown WalletButton se ferme sur `Escape` et clic extérieur (handlers `mousedown` + `keydown`). `aria-expanded` reflète l'état.
- **Hiérarchie sémantique** : `header`, `main`, `nav`, `footer`, `article`, `dl/dt/dd`. Pas de `div` porteur de sens.
- **Aria-labels** : tous les boutons interactifs en exposent un explicite (claim, connect, menu portefeuille). Les icônes décoratives portent `aria-hidden="true"`.
- **`MotionConfig reducedMotion="user"`** : désactive automatiquement les transformations Framer pour les utilisateurs sensitisés.

## Contrast ratios (sur fond #030308)
| Token | Couleur | Ratio | Niveau |
|---|---|---|---|
| ink-100 | #FFFFFF | 21.0:1 | AAA normal ✓ |
| ink-200 (corps) | #E6E6F0 | ~16:1 | AAA normal ✓ |
| ink-300 | #C4C4D6 | ~11.8:1 | AAA normal ✓ |
| ink-400 (labels) | #B0B0CE | ~9.6:1 | AAA normal ✓ |
| ink-500 (désactivé) | #6E6E8C | ~5.1:1 | AA normal ✓ / usage non-essentiel |
| accent-neon | #14F195 | ~13.6:1 | AAA normal ✓ |
| accent-gold | #FFD700 | ~14.5:1 | AAA normal ✓ |
| accent-violet (texte) | #C49AFF | ~9.4:1 | AAA normal ✓ |
| violet #9945FF (bordures/fonds) | — | 4.66:1 | AAA large ✓ (usage non-texte) |
| Blanc sur bouton violet (gradient #8435F0→#6A25D0) | — | 5.6→7.5:1 | AAA large ✓ ; texte bouton en `font-semibold` |

Note : les dégradés sur texte sont explicitement interdits par la spec — nous utilisons des couleurs solides (`text-accent-*`). Le seul dégradé est sur fonds de boutons/panneaux, sans impact contraste texte.

## Screen reader
- Adresses tronquées conservées en clair dans le `aria-label` (forme complète non coupée) — ex. `Réclamer 12.5000 SOL du pact Revenue Share`.
- `aria-busy` sur le bouton connect pendant la latence adapter.
- `aria-current="page"` sur le lien de navigation actif.
- Icônes SVG : `role="img"` quand informatives + `aria-label`, `aria-hidden="true"` quand décoratives.
