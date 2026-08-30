// src/components/QrCode.tsx
//
// Rendu d'un QR code en SVG, généré localement (aucun appel réseau).
//
// Ce composant était importé par PactStep3 mais n'existait pas dans le
// projet — c'est ce qui faisait planter le chargement de l'application
// entière : Vite ne résout pas `../QrCode`, l'erreur remonte au module
// racine et rien ne s'affiche.
//
// La génération elle-même vit dans lib/qr.ts (qrcode-generator, MIT).
// Ici on ne fait qu'injecter le SVG produit et le contraindre à la taille
// demandée.

import { useMemo } from 'react';
import { generateQrSvg } from '../lib/qr';

interface Props {
  /** Contenu encodé — typiquement l'URL publique du pact. */
  value: string;
  /** Côté du carré, en pixels. */
  size?: number;
}

export default function QrCode({ value, size = 96 }: Props) {
  // generateQrSvg est purement calculatoire mais non trivial (matrice +
  // correction d'erreur). On le mémoïse : PactStep3 se re-rend à chaque
  // frappe dans le formulaire, et l'URL, elle, ne change pas.
  const svg = useMemo(() => {
    if (!value) return '';
    try {
      return generateQrSvg(value);
    } catch {
      // Un QR peut échouer si le texte dépasse la capacité maximale du
      // format. Mieux vaut un trou dans l'UI qu'un écran blanc.
      return '';
    }
  }, [value]);

  if (!svg) return null;

  return (
    <div
      style={{ width: size, height: size }}
      // Le SVG est produit en local à partir d'une valeur applicative
      // (une URL construite par nos soins), pas d'une saisie tierce —
      // il n'y a pas de surface d'injection ici.
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="QR code"
      role="img"
    />
  );
}
