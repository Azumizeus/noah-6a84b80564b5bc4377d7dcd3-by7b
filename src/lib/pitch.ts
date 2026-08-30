// src/lib/pitch.ts
// ═══════════════════════════════════════════════════════════════════
// CreatePactWizard encode plusieurs infos dans le champ `description`
// on-chain (pas de champ structuré dédié dans le programme) :
//   "[<stage>] <pitch libre> | Rôles créateur : <rôles> | 💰 Seed founder : <n> SOL (...)"
// Ce parseur reconstitue un affichage propre pour la Marketplace, sans
// jamais supposer que les 3 parties sont présentes (le tout est tronqué
// à 280 octets côté programme, donc la fin peut manquer).
//
// IMPORTANT i18n : la clé entre crochets ([<stage>]) DOIT rester une
// chaîne canonique fixe, indépendante de la langue de l'utilisateur qui
// crée le pact — sinon un pact créé en anglais ne matcherait plus
// STAGE_MAP et perdrait son badge de stage sur la Marketplace. Le libellé
// AFFICHÉ dans le wizard (bouton) peut être traduit ; celui écrit
// on-chain (STAGE_CANONICAL) ne doit jamais l'être. Voir CreatePactWizard.tsx.
// ═══════════════════════════════════════════════════════════════════
import { translate, type Lang } from './i18n/translations';

export type PactStage = 'dev' | 'invest' | 'both' | null;

export interface ParsedPitch {
  stage: PactStage;
  stageLabel: string | null;
  pitch: string;
  rolesWanted: string;
  seedAmountSol: string | null;
}

/** Clés canoniques (fixes, jamais traduites) écrites dans le bracket on-chain. */
export const STAGE_CANONICAL: Record<Exclude<PactStage, null>, string> = {
  dev: '🔧 Recherche des devs',
  invest: '💰 Recherche des investisseurs',
  both: '🤝 Les deux',
};

const STAGE_MAP: Record<string, PactStage> = {
  '🔧 Recherche des devs': 'dev',
  '💰 Recherche des investisseurs': 'invest',
  '🤝 Les deux': 'both',
};

function currentLang(): Lang {
  try {
    const stored = localStorage.getItem('buildpact_lang');
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* non bloquant */
  }
  return 'fr';
}

/** Libellé du badge de stage affiché sur la Marketplace — traduit selon la langue courante. */
export function stageBadgeLabel(stage: Exclude<PactStage, null>): string {
  const key = stage === 'dev' ? 'marketplaceCard.badgeDev' : stage === 'invest' ? 'marketplaceCard.badgeInvest' : 'marketplaceCard.badgeBoth';
  return translate(currentLang(), key);
}

export function parsePitch(raw: string): ParsedPitch {
  let rest = raw;
  let stageLabel: string | null = null;
  let stage: PactStage = null;

  const bracketMatch = rest.match(/^\[([^\]]+)\]\s*/);
  if (bracketMatch) {
    stageLabel = bracketMatch[1];
    stage = STAGE_MAP[stageLabel] ?? null;
    rest = rest.slice(bracketMatch[0].length);
  }

  let pitch = rest;
  let rolesWanted = '';
  let seedAmountSol: string | null = null;

  const ROLE_MARK = ' | Rôles créateur : ';
  const SEED_MARK = ' | 💰 Seed founder : ';

  const roleIdx = rest.indexOf(ROLE_MARK);
  if (roleIdx !== -1) {
    pitch = rest.slice(0, roleIdx);
    const afterRoles = rest.slice(roleIdx + ROLE_MARK.length);
    const seedIdx = afterRoles.indexOf(SEED_MARK);
    if (seedIdx !== -1) {
      rolesWanted = afterRoles.slice(0, seedIdx);
      const seedMatch = afterRoles.slice(seedIdx + SEED_MARK.length).match(/^([\d.,]+)\s*SOL/);
      seedAmountSol = seedMatch ? seedMatch[1] : null;
    } else {
      rolesWanted = afterRoles;
    }
  }

  return {
    stage,
    stageLabel,
    pitch: pitch.trim(),
    rolesWanted: rolesWanted.trim(),
    seedAmountSol,
  };
}
