// src/components/ImageHoverPreview.tsx
// ═══════════════════════════════════════════════════════════════════
// Aperçu « vrai format » d'un logo ou d'une bannière, au CLIC (30/08 : le
// mode survol a été retiré — sur une grille dense il s'ouvrait au moindre
// passage de souris, ce qui gênait plus qu'il n'aidait).
//
// Problème résolu : dans les cards, les images sont volontairement
// recadrées (object-cover) pour que la grille reste régulière. Un logo
// carré passe en 40×40, une bannière 16:9 en bandeau 96px — le founder
// ne voit jamais ce qu'il a réellement uploadé, et un investisseur ne
// voit qu'un fragment.
//
// Point structurant : l'overlay est monté dans un PORTAIL sur <body>. Les
// cards ont `overflow-hidden` (indispensable pour le bleed de la bannière
// jusqu'aux bords) : un overlay rendu en enfant serait découpé au cadre de
// la card, donc inutilisable. Le portail sort de l'arbre de clipping.
// ═══════════════════════════════════════════════════════════════════
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../lib/ThemeContext';

/**
 * Boîte d'affichage selon la nature de l'image.
 *
 * ⚠️ Point clé du correctif : `object-contain` ne redimensionne RIEN par
 * lui-même. Il ne fait que décider comment une image se place dans la boîte
 * qu'on lui donne. Posé sur un `<img>` qui n'a que des `max-h`/`max-w`, il
 * n'agit donc que comme un plafond : une bannière 3000px se contentait de
 * gonfler jusqu'à 86vw/78vh, et un logo de 64px restait affiché en 64px,
 * minuscule au centre de l'écran. C'est exactement l'inverse de ce qu'on
 * attend d'un « aperçu ».
 *
 * On donne donc à chaque aperçu une vraie boîte de taille fixe, et
 * `object-contain` fait enfin son travail dans les deux sens : il agrandit
 * les petites images et réduit les grandes, toujours au ratio d'origine.
 */
const BOX: Record<'logo' | 'banner', string> = {
  // Carré : un logo est presque toujours 1:1, une boîte large laisserait des
  // vides latéraux énormes.
  logo: 'h-[min(320px,60vw)] w-[min(320px,60vw)]',
  // Large : cadre 16:9 environ, plafonné pour ne jamais toucher les bords.
  banner: 'h-[min(495px,58vh)] w-[min(880px,86vw)]',
};

interface Props {
  /** URL affichée en grand. Si absente, le composant est transparent. */
  src?: string;
  alt?: string;
  /** Détermine la boîte d'aperçu. Par défaut : bannière (cas le plus large). */
  kind?: 'logo' | 'banner';
  /** Le rendu normal (miniature recadrée) — inchangé. */
  children: ReactNode;
  /** Classes du conteneur déclencheur, pour ne rien casser du layout parent. */
  className?: string;
}

export function ImageHoverPreview({
  src,
  alt = '',
  kind = 'banner',
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  // Réglage utilisateur : activer/désactiver complètement l'aperçu. Voir
  // ImagePreviewSettings.tsx / ThemeContext. Le déclencheur est désormais
  // toujours le clic — le mode survol a été retiré (30/08) : sur une grille
  // dense, l'aperçu plein écran s'ouvrait au moindre passage de souris, ce
  // qui gênait plus qu'il n'aidait.
  const { previewEnabled } = useTheme();

  // Complètement désactivé au réglage → comportement identique à avant ce
  // composant : juste les children, aucun wrapper.
  if (!src || !previewEnabled) return <>{children}</>;

  const closeNow = () => setOpen(false);
  const toggleOpen = () => setOpen((v) => !v);

  const triggerProps = { onClick: toggleOpen };

  return (
    <>
      <div className={className} {...triggerProps}>
        {children}
      </div>

      {open &&
        createPortal(
          <div
            // pointer-events-none en mode survol : l'overlay ne doit jamais
            // voler le survol à la card en dessous, sinon il se refermerait
            // aussitôt ouvert (mouseleave déclenché par son propre affichage).
            // En mode clic, l'overlay DOIT capter le clic pour pouvoir se
            // refermer au clic (n'importe où, y compris sur l'image).
            className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center p-6"
            // Fond réduit (29/08) : un dégradé radial centré plutôt qu'un
            // aplat plein écran — la zone sombre "rétrécit" autour de
            // l'image au lieu de noyer toute la page, et l'opacité max
            // baisse de 0.75 à 0.55. backdrop-blur allégé pour la même
            // raison (moins de surface visuellement "lourde").
            style={{
              background:
                'radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.32) 45%, rgba(0,0,0,0.08) 72%, transparent 88%)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
            onClick={closeNow}
            aria-hidden="true"
          >
            <figure className="flex flex-col items-center gap-3">
              <div
                className={
                  'flex items-center justify-center overflow-hidden rounded-xl bg-black/40 shadow-[0_24px_80px_-12px_rgba(153,69,255,0.45)] ring-1 ring-white/15 ' +
                  BOX[kind]
                }
              >
                <img
                  src={src}
                  alt={alt}
                  // object-contain dans une boîte dimensionnée : ratio d'origine
                  // respecté, aucun recadrage, et l'image occupe enfin le cadre
                  // quelle que soit sa résolution native.
                  className="h-full w-full object-contain"
                />
              </div>
              <figcaption className="font-mono text-[11px] uppercase tracking-widest text-white/45">
                format d'origine
              </figcaption>
            </figure>
          </div>,
          document.body
        )}
    </>
  );
}

export default ImageHoverPreview;
