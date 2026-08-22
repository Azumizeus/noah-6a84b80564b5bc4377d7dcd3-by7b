// src/components/QrCode.tsx
import { useMemo } from 'react';
import { generateQrSvg } from '../lib/qr';

interface Props {
  /** Texte/URL encodé dans le QR code */
  value: string;
  /** Taille d'affichage en px (le SVG est scalable, une seule dimension suffit) */
  size?: number;
  className?: string;
}

/** QR code généré 100% côté client, sans appel réseau. */
export function QrCode({ value, size = 160, className }: Props) {
  const svg = useMemo(() => generateQrSvg(value), [value]);
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code vers ${value}`}
      // SVG généré localement à partir d'un texte qu'on contrôle (URL du pact) — pas d'entrée utilisateur libre
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default QrCode;
