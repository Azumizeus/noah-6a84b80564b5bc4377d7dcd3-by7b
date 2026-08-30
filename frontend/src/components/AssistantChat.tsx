// src/components/AssistantChat.tsx
// ═══════════════════════════════════════════════════════════════════
// Nexus — bulle flottante + panneau de chat. Module AUTONOME : ne lit/
// n'écrit aucune table du projet, ne dépend d'aucun autre composant
// métier. Peut être retiré du montage (voir DashboardLayout.tsx, un seul
// point d'import) sans toucher à rien d'autre — c'est le sens de
// "branchable/débranchable" demandé.
//
// N'est monté (et ne rend rien) que si ASSISTANT_ENABLED — flag de build
// (VITE_ASSISTANT_ENABLED), voir lib/assistant.ts. Double sécurité : même
// oublié importé quelque part, le composant est un no-op par défaut.
//
// BYOK : la clé API de l'utilisateur reste dans son navigateur (voir
// lib/assistant.ts) — ce composant ne l'envoie qu'à assistant-chat, à
// chaque message, jamais à une table Supabase.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ASSISTANT_ENABLED,
  MODEL_PLACEHOLDER,
  clearAssistantConfig,
  loadAssistantConfig,
  saveAssistantConfig,
  sendAssistantMessage,
  type AssistantConfig,
  type AssistantMessage,
  type AssistantProvider,
} from '../lib/assistant';
import { clamp, loadBubblePos, saveBubblePos, type BubblePos } from '../lib/assistantBubble';
import { useLanguage } from '../lib/i18n/LanguageContext';

// Taille de la bulle (h-14 w-14 = 56px) + marge par défaut (bottom-5/right-5
// = 20px) — dupliqué en dur ici volontairement : ce sont des px d'écran,
// pas des classes Tailwind, donc pas de variable partagée possible.
const BUBBLE_SIZE = 56;
const DEFAULT_MARGIN = 20;
const PANEL_W = 352; // w-[22rem]
const PANEL_H = 448; // h-[28rem]
const GAP = 8;

// Décalage vertical par défaut plus grand que DEFAULT_MARGIN : le badge
// « Seeker · Nexus » (SeekerNexusBadge.tsx) occupe déjà le coin bas-droit
// (bottom-4 right-4) sur toutes les pages — sans ce décalage la bulle se
// superpose au badge au premier chargement. L'utilisateur peut ensuite la
// glisser où il veut, mais le point de départ ne doit pas déjà être en
// collision.
const DEFAULT_BOTTOM_OFFSET = 88;

function defaultBubblePos(): BubblePos {
  return {
    x: window.innerWidth - BUBBLE_SIZE - DEFAULT_MARGIN,
    y: window.innerHeight - BUBBLE_SIZE - DEFAULT_BOTTOM_OFFSET,
  };
}

/** Position du panneau de chat, ancrée au coin de la bulle et retournée
 *  au-dessus par défaut — bascule en dessous si pas assez de place en
 *  haut (bulle glissée près du bord supérieur de l'écran). */
function panelStyle(pos: BubblePos): { left: number; top: number; width: number; height: number } {
  const width = Math.min(PANEL_W, window.innerWidth - 2 * GAP);
  const height = Math.min(PANEL_H, window.innerHeight - 2 * GAP);
  let left = pos.x + BUBBLE_SIZE - width;
  left = clamp(left, GAP, window.innerWidth - width - GAP);
  let top = pos.y - height - GAP;
  if (top < GAP) top = pos.y + BUBBLE_SIZE + GAP;
  top = clamp(top, GAP, window.innerHeight - height - GAP);
  return { left, top, width, height };
}

type View = 'chat' | 'settings';

export function AssistantChat() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('chat');
  const [pos, setPos] = useState<BubblePos>(() => loadBubblePos() ?? defaultBubblePos());
  const dragStart = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const dragged = useRef(false);
  // Dernière position calculée pendant le glisser — lue par handlePointerUp
  // pour la sauvegarde. Ne PAS relire `pos` (state) à ce moment-là : un
  // drag très rapide peut enchaîner pointerdown/move/up avant que React
  // n'ait eu le temps de re-render, ce qui donnerait une closure `pos`
  // encore périmée dans handlePointerUp.
  const lastPos = useRef<BubblePos>(pos);
  const [config, setConfig] = useState<AssistantConfig | null>(() => loadAssistantConfig());
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Formulaire de réglages — brouillon local, appliqué seulement au clic
  // sur "Enregistrer" (jamais posé en config tant que non validé).
  const [draftProvider, setDraftProvider] = useState<AssistantProvider>(config?.provider ?? 'anthropic');
  const [draftKey, setDraftKey] = useState(config?.apiKey ?? '');
  const [draftModel, setDraftModel] = useState(config?.model ?? '');
  const [draftBaseUrl, setDraftBaseUrl] = useState(config?.baseUrl ?? '');

  useEffect(() => {
    if (!open) return;
    if (!config && view === 'chat') setView('settings');
  }, [open, config, view]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, DEFAULT_MARGIN, window.innerWidth - BUBBLE_SIZE - DEFAULT_MARGIN),
        y: clamp(p.y, DEFAULT_MARGIN, window.innerHeight - BUBBLE_SIZE - DEFAULT_MARGIN),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!ASSISTANT_ENABLED) return null;

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragStart.current = { x: e.clientX, y: e.clientY, origX: pos.x, origY: pos.y };
    dragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!dragged.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dragged.current = true;
    if (!dragged.current) return;
    const next = {
      x: clamp(dragStart.current.origX + dx, DEFAULT_MARGIN, window.innerWidth - BUBBLE_SIZE - DEFAULT_MARGIN),
      y: clamp(dragStart.current.origY + dy, DEFAULT_MARGIN, window.innerHeight - BUBBLE_SIZE - DEFAULT_MARGIN),
    };
    lastPos.current = next;
    setPos(next);
  };

  const handlePointerUp = () => {
    if (dragged.current) saveBubblePos(lastPos.current);
    dragStart.current = null;
  };

  const handleBubbleClick = () => {
    // Un glisser réel ne doit pas aussi ouvrir/fermer le panneau — seul un
    // clic (sans déplacement notable) bascule `open`.
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setOpen((v) => !v);
  };

  const handleSaveConfig = () => {
    const next: AssistantConfig = {
      provider: draftProvider,
      apiKey: draftKey.trim(),
      model: draftModel.trim() || MODEL_PLACEHOLDER[draftProvider],
      baseUrl: draftProvider === 'openai' ? draftBaseUrl.trim() || undefined : undefined,
    };
    saveAssistantConfig(next);
    setConfig(next);
    setView('chat');
  };

  const handleClearConfig = () => {
    clearAssistantConfig();
    setConfig(null);
    setDraftKey('');
    setMessages([]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !config || sending) return;
    const nextMessages: AssistantMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);
    const res = await sendAssistantMessage(config, nextMessages);
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
  };

  return (
    <>
      {/* Bulle flottante — z-40 : sous les modales (z-50) mais au-dessus du
          reste, pour ne jamais bloquer un dialogue existant. Déplaçable :
          glisser-déposer (souris/tactile) via pointer events, position
          persistée en localStorage (voir lib/assistantBubble.ts). Un clic
          simple (sans déplacement notable) bascule l'ouverture — la
          distinction se fait dans handleBubbleClick. */}
      <button
        type="button"
        onClick={handleBubbleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label={t('assistant.bubbleLabel')}
        aria-expanded={open}
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        className="fixed z-40 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-accent-violet/90 text-2xl shadow-lg shadow-black/40 transition hover:bg-accent-violet active:cursor-grabbing"
      >
        {open ? '✕' : '🧭'}
      </button>

      {open && (
        <div
          style={panelStyle(pos)}
          className="modal-surface fixed z-40 flex flex-col overflow-hidden shadow-2xl shadow-black/50"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <div>
              <p className="font-sans text-sm font-bold text-white">{t('assistant.title')}</p>
              <p className="text-[11px] text-ink-400">{t('assistant.subtitle')}</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
                aria-label={t('assistant.tabSettings')}
                className="rounded-md p-1.5 text-ink-400 transition hover:text-white"
              >
                ⚙️
              </button>
            </div>
          </div>

          {view === 'settings' || !config ? (
            <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
              <p className="leading-relaxed text-ink-300">{t('assistant.settingsIntro')}</p>

              <div>
                <p className="mb-1 font-semibold text-white">{t('assistant.providerLabel')}</p>
                <div className="flex gap-2">
                  {(['anthropic', 'openai'] as AssistantProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDraftProvider(p)}
                      className={
                        'flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition ' +
                        (draftProvider === p
                          ? 'border-accent-violet/50 bg-white/[0.06] text-white'
                          : 'border-white/10 text-ink-400 hover:text-ink-200')
                      }
                    >
                      {p === 'anthropic' ? t('assistant.providerAnthropic') : t('assistant.providerOpenAi')}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block font-semibold text-white">{t('assistant.apiKeyLabel')}</span>
                <input
                  type="password"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  placeholder={t('assistant.apiKeyPlaceholder')}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white outline-none focus:border-accent-violet/50"
                  autoComplete="off"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-white">{t('assistant.modelLabel')}</span>
                <input
                  type="text"
                  value={draftModel}
                  onChange={(e) => setDraftModel(e.target.value)}
                  placeholder={MODEL_PLACEHOLDER[draftProvider]}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white outline-none focus:border-accent-violet/50"
                />
              </label>

              {draftProvider === 'openai' && (
                <label className="block">
                  <span className="mb-1 block font-semibold text-white">{t('assistant.baseUrlLabel')}</span>
                  <input
                    type="text"
                    value={draftBaseUrl}
                    onChange={(e) => setDraftBaseUrl(e.target.value)}
                    placeholder={t('assistant.baseUrlPlaceholder')}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white outline-none focus:border-accent-violet/50"
                  />
                </label>
              )}

              <p className="rounded-md border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-ink-500">
                {t('assistant.byokNotice')}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={!draftKey.trim()}
                  className="flex-1 rounded-md bg-accent-violet/90 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent-violet disabled:opacity-40"
                >
                  {t('assistant.saveConfig')}
                </button>
                {config && (
                  <button
                    type="button"
                    onClick={handleClearConfig}
                    className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-ink-400 transition hover:text-white"
                  >
                    {t('assistant.clearConfig')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                {messages.length === 0 && (
                  <p className="text-[11px] leading-relaxed text-ink-500">{t('assistant.emptyState')}</p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      'max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ' +
                      (m.role === 'user'
                        ? 'ml-auto bg-accent-violet/20 text-white'
                        : 'bg-white/[0.06] text-ink-200')
                    }
                  >
                    {m.content}
                  </div>
                ))}
                {sending && <div className="text-[11px] text-ink-500">{t('assistant.thinking')}</div>}
                {error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">
                    {t('assistant.errorPrefix')} {error}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 p-2">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={t('assistant.inputPlaceholder')}
                    className="flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-accent-violet/50"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="rounded-md bg-accent-violet/90 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent-violet disabled:opacity-40"
                  >
                    {t('assistant.send')}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[9px] leading-tight text-ink-600">{t('assistant.legalNotice')}</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default AssistantChat;
