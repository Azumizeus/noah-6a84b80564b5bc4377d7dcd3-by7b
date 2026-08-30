// src/lib/assistantBubble.ts
// ═══════════════════════════════════════════════════════════════════
// Position (coin haut-gauche, en px écran) de la bulle flottante Nexus.
// Préférence d'appareil (comme densité/vue) — pas liée au wallet, pas
// synchronisée entre appareils. Persistée après un vrai glisser-déposer
// uniquement (un simple clic ne sauvegarde rien, voir AssistantChat.tsx).
// ═══════════════════════════════════════════════════════════════════

export interface BubblePos {
  x: number;
  y: number;
}

const KEY = 'buildpact_assistant_bubble_pos';

export function loadBubblePos(): BubblePos | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BubblePos>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveBubblePos(pos: BubblePos): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos));
  } catch {
    // localStorage indisponible (navigation privée, quota) — on ignore,
    // la bulle retombera juste à sa position par défaut la prochaine fois.
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
