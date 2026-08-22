// src/lib/qr.ts
// ═══════════════════════════════════════════════════════════════════
// Génération de QR code 100% locale, sans appel réseau — fiabilité
// démo garantie (pas de dépendance à une API externe pendant le pitch).
// Utilise la lib vendorée `vendor/qrcode-generator.js` (Kazuhiko Arase,
// MIT, aucune dépendance) plutôt qu'un package npm : évite de toucher
// package.json/package-lock.json dans le workflow copier-coller GitHub.
// ═══════════════════════════════════════════════════════════════════
// @ts-ignore — fichier JS vendoré, pas de types (voir allowJs dans tsconfig.json)
import qrcodeFactory from './vendor/qrcode-generator.js';

/**
 * Génère le SVG (chaîne `<svg>...</svg>`) d'un QR code encodant `text`.
 * `scalable: true` → pas de width/height fixes, le SVG suit son conteneur CSS.
 */
export function generateQrSvg(text: string, cellSize = 4, margin = 8): string {
  // typeNumber=0 → taille auto-détectée selon la longueur du texte.
  // Niveau 'M' → correction d'erreur moyenne (15%), bon compromis lisibilité/densité.
  const qr = qrcodeFactory(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true });
}
