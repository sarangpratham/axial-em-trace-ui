export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'decision-tracer:theme-mode';
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

export function resolveThemeMode(value: string | null | undefined): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

export function readStoredThemeMode(storage?: Pick<Storage, 'getItem'> | null): ThemeMode {
  if (!storage) return DEFAULT_THEME_MODE;
  try {
    return resolveThemeMode(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function writeStoredThemeMode(
  mode: ThemeMode,
  storage?: Pick<Storage, 'setItem'> | null,
) {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage availability issues
  }
}

export function applyThemeMode(
  mode: ThemeMode,
  root?: Pick<HTMLElement, 'dataset' | 'style'> | null,
) {
  if (!root) return;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

export function getInitialThemeMode(): ThemeMode {
  if (typeof document !== 'undefined') {
    const attrMode = document.documentElement.dataset.theme;
    if (isThemeMode(attrMode)) return attrMode;
  }

  if (typeof window !== 'undefined') {
    return readStoredThemeMode(window.localStorage);
  }

  return DEFAULT_THEME_MODE;
}
