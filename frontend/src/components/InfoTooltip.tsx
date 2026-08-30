// src/components/InfoTooltip.tsx
// ═══════════════════════════════════════════════════════════════════
// Petit "?" au survol/focus — demande explicite (29/08, nuit) : "un
// petit point d'interrogation pour expliquer mode d'emploi les fonctions
// et boutons au survole du point d'interrogation, clair et précis",
// citant en exemple exact le texte déjà écrit pour le RPC personnalisé
// (settings.rpcHint). Ce composant ne DUPLIQUE pas ce texte : il sert de
// receptacle générique, chaque appelant lui passe SA propre explication
// (souvent une clé i18n déjà existante — voir settings.*Hint).
//
// Bug corrigé (30/08, 1) : la bulle était positionnée en `absolute` dans
// son propre conteneur. Dans un panneau scrollable (ProfileSettingsModal a
// `overflow-y-auto`), ça la découpait purement et simplement dès qu'elle
// dépassait le cadre visible — souvent invisible sur les réglages en bas
// de liste. Fix : la bulle est désormais montée dans un PORTAIL sur
// <body>, en `position: fixed`, positionnée au clic/survol via
// getBoundingClientRect() du bouton, et recalée/fermée si la page défile
// pendant qu'elle est ouverte. Elle ne peut donc plus être coupée par un
// conteneur parent, quel qu'il soit — même logique que ImageHoverPreview.
//
// Bug corrigé (30/08, 2) : "elle disparaît trop vite, pas le temps de
// lire". Deux causes cumulées : (a) la fermeture était instantanée au
// mouseleave du bouton — dès que le curseur quittait le petit cercle de
// 16px, la bulle se fermait, y compris pendant le trajet souris vers le
// texte ; (b) la bulle avait `pointer-events-none`, donc même en
// l'atteignant, il était impossible d'y rester dessus pour continuer à
// lire. Fix : un délai avant fermeture (250ms, annulé si le curseur entre
// sur le bouton OU sur la bulle), et la bulle capte maintenant le survol
// (`pointer-events-auto` + ses propres onMouseEnter/onMouseLeave).
//
// Accessibilité : bouton réel (pas un <span>), aria-describedby relie le
// bouton au texte pour les lecteurs d'écran, apparition au survol ET au
// focus clavier (pas seulement :hover — sinon invisible au clavier). Au
// clavier, pas de délai de fermeture : le blur reste immédiat, plus
// prévisible qu'un délai pour ce mode d'interaction.
// ═══════════════════════════════════════════════════════════════════
import { useId, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  text: string;
  /** Optionnel — sinon dérive un id interne (useId). Utile seulement si un
   *  appelant a besoin de le référencer depuis ailleurs (rare). */
  id?: string;
  className?: string;
}

const TOOLTIP_WIDTH = 224; // w-56
const GAP = 6; // mt-1.5
const EDGE_MARGIN = 8; // marge de sécurité avec le bord de l'écran
const CLOSE_DELAY = 250; // ms — laisse le temps de traverser le petit vide bouton→bulle

export function InfoTooltip({ text, id, className = '' }: Props) {
  const autoId = useId();
  const tooltipId = id ?? autoId;
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = r.left + r.width / 2;
    // Centré sous le bouton, mais jamais coupé sur les bords de l'écran.
    const left = Math.min(
      Math.max(center - TOOLTIP_WIDTH / 2, EDGE_MARGIN),
      window.innerWidth - TOOLTIP_WIDTH - EDGE_MARGIN
    );
    setCoords({ left, top: r.bottom + GAP });
  }, []);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const open = () => {
    cancelClose();
    place();
  };

  /** Fermeture différée (survol) — laisse le temps d'atteindre la bulle. */
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setCoords(null), CLOSE_DELAY);
  };

  /** Fermeture immédiate (clavier : blur, ou sortie de la bulle elle-même
   *  n'a pas besoin d'un délai supplémentaire côté clavier). */
  const closeNow = () => {
    cancelClose();
    setCoords(null);
  };

  // La bulle est en `fixed` : elle ne suit pas le scroll d'un conteneur
  // parent. Plutôt que de la repositionner à chaque pixel défilé (coûteux
  // et jamais parfaitement fluide), on la ferme dès qu'un scroll démarre —
  // comportement standard de ce type de tooltip.
  useLayoutEffect(() => {
    if (!coords) return;
    const onScroll = () => closeNow();
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  return (
    <span className={`inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-describedby={tooltipId}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={closeNow}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[10px] font-bold leading-none text-ink-400 transition hover:border-accent-violet/40 hover:text-white focus:border-accent-violet/40 focus:text-white focus:outline-none"
      >
        ?
      </button>
      {coords &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="modal-surface pointer-events-auto fixed z-[80] rounded-lg border border-white/10 p-2.5 text-[11px] font-normal leading-relaxed text-ink-200 shadow-xl"
            style={{ left: coords.left, top: coords.top, width: TOOLTIP_WIDTH }}
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}

export default InfoTooltip;
