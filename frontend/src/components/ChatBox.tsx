// src/components/ChatBox.tsx
// ═══════════════════════════════════════════════════════════════════
// Chat simple par projet — lecture + Realtime, écriture ouverte à tout
// wallet connecté (n'importe qui peut lire/écrire, pas juste les membres :
// un backer/curieux doit pouvoir poser une question avant même de rejoindre).
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatAddress } from '../lib/pacts';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { fetchProfilesByWallets } from '../lib/profileRemote';
import type { BuilderProfile } from '../lib/profile';
import {
  chatEnabled,
  fetchChatMessages,
  postChatMessage,
  subscribeToChatMessages,
  validateChatBody,
  type ChatMessage,
} from '../lib/chat';

interface Props {
  projectPda: string;
}

export function ChatBox({ projectPda }: Props) {
  const { publicKey, connected } = useWallet();
  const { t, lang } = useLanguage();

  const timeLabel = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Map<string, BuilderProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatEnabled) { setLoading(false); return; }
    let cancelled = false;
    fetchChatMessages(projectPda).then((msgs) => {
      if (!cancelled) { setMessages(msgs); setLoading(false); }
    });
    const unsubscribe = subscribeToChatMessages(projectPda, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [projectPda]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Résout pseudo + avatar des auteurs — affichage plus lisible qu'une
  // adresse wallet tronquée pour tout le monde. Best-effort : si Supabase
  // n'a pas de profil pour un wallet, on retombe sur l'adresse (voir displayName()).
  useEffect(() => {
    const wallets = Array.from(new Set(messages.map((m) => m.authorWallet)));
    if (wallets.length === 0) return;
    fetchProfilesByWallets(wallets).then(setProfiles);
  }, [messages]);

  const displayName = (wallet: string): string => profiles.get(wallet)?.pseudo?.trim() || formatAddress(wallet);
  const avatarUrl = (wallet: string): string | null => profiles.get(wallet)?.avatarUrl ?? null;

  if (!chatEnabled) return null;

  const handleSend = async () => {
    if (!publicKey) return;
    const invalid = validateChatBody(body);
    if (invalid) { setError(invalid); return; }
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const r = await postChatMessage({ projectPda, authorWallet: publicKey.toBase58(), body });
    setSending(false);
    if ('error' in r) { setError(r.error); return; }
    setBody('');
  };

  return (
    <div className="glass-panel flex flex-col p-4">
      <h3 className="mb-3 font-sans text-sm font-semibold text-white">{t('chat.heading')}</h3>

      <div ref={listRef} className="mb-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />)}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-ink-400">{t('chat.empty')}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5 h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/30">
                {avatarUrl(m.authorWallet) ? (
                  <img src={avatarUrl(m.authorWallet)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] text-ink-500">
                    {displayName(m.authorWallet).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-ink-300">
                  {displayName(m.authorWallet)}
                  {m.authorWallet === publicKey?.toBase58() && <span className="ml-1 text-accent-violet">{t('chat.you')}</span>}
                </span>{' '}
                <span className="text-ink-500">· {timeLabel(m.createdAt)}</span>
                <p className="mt-0.5 whitespace-pre-wrap text-ink-200">{m.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {connected ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <label htmlFor="chat-input" className="sr-only">{t('chat.placeholder')}</label>
            <input
              id="chat-input"
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSend(); }}
              maxLength={500}
              placeholder={t('chat.placeholder')}
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-ink-500 focus:border-accent-violet/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !body.trim()}
              className="shrink-0 rounded-lg bg-accent-violet px-3 py-2 text-xs font-medium text-ink-900 transition hover:bg-accent-violet/90 disabled:opacity-50"
            >
              {sending ? t('chat.sending') : t('chat.send')}
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      ) : (
        <p className="text-[11px] text-ink-500">{t('chat.connectPrompt')}</p>
      )}
    </div>
  );
}

export default ChatBox;
