export const DEFAULT_PREFERENCES = Object.freeze({
  theme: "light",
  language: "pt",
  notifications: Object.freeze({ lowStock: true, newOrders: true, separation: false, reports: true }),
})

export function preferencesKey(userId) {
  return userId ? `modusdestinatio_preferences_v2:${userId}` : null
}

export function normalizePreferences(value) {
  return {
    theme: value?.theme === "dark" ? "dark" : "light",
    language: "pt",
    notifications: Object.fromEntries(Object.entries(DEFAULT_PREFERENCES.notifications).map(([key, fallback]) =>
      [key, typeof value?.notifications?.[key] === "boolean" ? value.notifications[key] : fallback]
    )),
  }
}

export function loadUserPreferences(storage, userId) {
  // The legacy value has no owner and must never be assigned to a new account.
  try { storage.removeItem("modusdestinatio_preferences") } catch { /* storage unavailable */ }
  try {
    return normalizePreferences(userId ? JSON.parse(storage.getItem(preferencesKey(userId))) : null)
  } catch {
    return normalizePreferences(null)
  }
}

export function saveUserPreferences(storage, userId, value) {
  if (!userId) return false
  try {
    storage.setItem(preferencesKey(userId), JSON.stringify(normalizePreferences(value)))
    return true
  } catch {
    return false
  }
}

export function applyPreferenceTheme(preferences) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("modus-dark", preferences.theme === "dark")
  }
}

export function preferencesStorage() {
  try { return window.localStorage } catch { return null }
}
