// src/components/MediaPicker.tsx
// ═══════════════════════════════════════════════════════════════════
// Sélecteur d'image réutilisable (logo carré ou bannière large) — gère
// juste la sélection + aperçu local (object URL). L'upload réel vers
// Supabase est géré par l'appelant (CreatePactWizard à la création,
// EditMediaModal après coup) : ce composant reste "bête" et partagé
// entre les deux contextes, comme AddMemberModal/CreatePactWizard
// partagent déjà ../lib/roles.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { validateMediaFile } from '../lib/media';

interface Props {
  kind: 'logo' | 'banner';
  label: string;
  hint: string;
  initialUrl?: string | null;
  onChange: (file: File | null) => void;
}

export function MediaPicker({ kind, label, hint, initialUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Libère l'ancien object URL en mémoire quand un nouveau fichier remplace le précédent
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const invalid = validateMediaFile(file, kind);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const aspectCls = kind === 'logo' ? 'aspect-square w-24' : 'aspect-[3/1] w-full';

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-white">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={
          `relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${aspectCls} ` +
          (dragOver
            ? 'border-accent-violet bg-violet-500/10'
            : 'border-white/15 bg-base-900/40 hover:border-accent-violet/40')
        }
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-[11px] text-ink-400">
            {kind === 'logo' ? '🖼️ Glisse ou clique' : '🏞️ Glisse ou clique — image large'}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <small className="mt-1 block text-[11px] text-ink-400">{hint}</small>
      {error && <small className="mt-1 block text-[11px] text-red-400">{error}</small>}
    </div>
  );
}

export default MediaPicker;
