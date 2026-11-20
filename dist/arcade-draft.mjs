const key = 'breakpoint:arcade-receipt';

export function saveArcadeDraft(draft) {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // The arcade is still available when browser storage is disabled.
  }
}

export function readArcadeDraft({ consume = false } = {}) {
  try {
    const saved = sessionStorage.getItem(key);
    if (consume) sessionStorage.removeItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
