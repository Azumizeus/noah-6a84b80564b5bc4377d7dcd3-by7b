// src/components/SolUsdAmount.tsx
// ═══════════════════════════════════════════════════════════════════
// "≈ $X.XX" à côté d'un montant SOL déjà affiché — rendu vide si le
// réglage est désactivé (défaut) ou si le prix n'a pas pu être obtenu,
// pour ne jamais afficher une estimation fausse/périmée sans le dire.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { getSolUsdPrice } from '../lib/pythPrice';
import { loadShowUsd } from '../lib/usdDisplay';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function SolUsdAmount({ sol }: { sol: number }) {
  const { t } = useLanguage();
  const [enabled] = useState(() => loadShowUsd());
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getSolUsdPrice().then((p) => {
      if (!cancelled) setPrice(p);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;
  if (price === null) {
    return <span className="ml-1 text-[10px] font-normal text-ink-500">({t('settings.usdUnavailable')})</span>;
  }
  const usd = sol * price;
  return (
    <span className="ml-1 text-[10px] font-normal text-ink-400">
      ≈ ${usd < 0.01 && usd > 0 ? usd.toFixed(4) : usd.toFixed(2)}
    </span>
  );
}

export default SolUsdAmount;
