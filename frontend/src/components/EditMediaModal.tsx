// src/components/EditMediaModal.tsx
// ═══════════════════════════════════════════════════════════════════
// Modale founder-only pour ajouter/remplacer le logo et la bannière d'un
// projet APRÈS sa création — même style que AddMemberModal (bg-[#0d0d15],
// border-purple-500/30). Upload direct vers Supabase, pas de transaction
// on-chain, donc pas de wallet à signer ici.
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { uploadProjectMedia, setProjectVideo, validateVideoUrl } from '../lib/media';
import MediaPicker from './MediaPicker';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  projectPda: string;
  projectTitle: string;
  currentLogoUrl?: string | null;
  currentBannerUrl?: string | null;
  currentVideoUrl?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditMediaModal({
  projectPda,
  projectTitle,
  currentLogoUrl,
  currentBannerUrl,
  currentVideoUrl,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useLanguage();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const videoChanged = videoUrl.trim() !== (currentVideoUrl ?? '').trim();
  const videoError = videoChanged ? validateVideoUrl(videoUrl) : null;

  const handleSave = async () => {
    if (!logoFile && !bannerFile && !videoChanged) {
      onClose();
      return;
    }
    if (videoError) {
      setError(videoError);
      return;
    }
    setSaving(true);
    setError(null);
    const failures: string[] = [];

    if (logoFile) {
      const r = await uploadProjectMedia(projectPda, logoFile, 'logo');
      if ('error' in r) failures.push(`Logo : ${r.error}`);
    }
    if (bannerFile) {
      const r = await uploadProjectMedia(projectPda, bannerFile, 'banner');
      if ('error' in r) failures.push(`Bannière : ${r.error}`);
    }
    if (videoChanged) {
      const r = await setProjectVideo(projectPda, videoUrl);
      if ('error' in r) failures.push(`Vidéo : ${r.error}`);
    }

    setSaving(false);
    if (failures.length > 0) {
      setError(failures.join(' — '));
      return;
    }
    setDone(true);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d15] border border-purple-500/30 rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">{t('editMedia.title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          {t('editMedia.project')} <span className="text-purple-400">{projectTitle}</span>
        </p>

        <div className="space-y-4">
          <MediaPicker
            kind="logo"
            label={t('editMedia.logoLabel')}
            hint={t('editMedia.logoHint')}
            initialUrl={currentLogoUrl}
            onChange={setLogoFile}
          />
          <MediaPicker
            kind="banner"
            label={t('editMedia.bannerLabel')}
            hint={t('editMedia.bannerHint')}
            initialUrl={currentBannerUrl}
            onChange={setBannerFile}
          />

          <div>
            <label htmlFor="pitch-video-url" className="mb-1 block text-sm font-medium text-white">
              {t('editMedia.videoLabel')}
            </label>
            <input
              id="pitch-video-url"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={t('editMedia.videoPlaceholder')}
              className="w-full rounded-lg border border-purple-500/30 bg-black/50 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              {t('editMedia.videoHint')}
            </p>
            {videoChanged && videoError && (
              <p className="mt-1 text-[11px] text-red-400">{videoError}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {done && (
          <div className="mt-3 bg-accent-neon/10 border border-accent-neon/30 rounded-lg p-3 text-sm text-accent-neon">
            {t('editMedia.saved')}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm font-medium"
            disabled={saving}
          >
            {done ? t('editMedia.close') : t('editMedia.cancel')}
          </button>
          {!done && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (!logoFile && !bannerFile && !videoChanged)}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? t('editMedia.saving') : t('editMedia.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
