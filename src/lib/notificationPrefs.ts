// src/lib/notificationPrefs.ts
// ═══════════════════════════════════════════════════════════════════
// Préférences de notifications — v1 HONNÊTE : aucune notification
// push/email n'est envoyée. Ce sont des préférences LOCALES qui
// préparent le terrain (le jour où une vraie livraison existe, ce
// fichier définit déjà quels événements l'utilisateur veut suivre :
// approbation de membre, financement reçu, quête réclamable).
// Ne pas laisser croire à une notification réellement envoyée —
// voir settings.notificationsHint côté UI.
// ═══════════════════════════════════════════════════════════════════
export interface NotificationPrefs {
  approvals: boolean;
  funding: boolean;
  quests: boolean;
}

const KEY = 'buildpact_notif_prefs';
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  approvals: true,
  funding: true,
  quests: true,
};

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* non bloquant */
  }
}
