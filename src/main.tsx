import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initDb, getSetting, SETTING_KEYS } from './db';

// ─── Theme bootstrap ─────────────────────────────────────────────────────────
// Spec 10.6: light + dark, system preference by default, manual override
// stored in IndexedDB. We apply the right class to <html> *before* React
// mounts so the user never sees a flash of the wrong theme.
async function applyInitialTheme(): Promise<void> {
  let override: string | undefined;
  try {
    override = await getSetting(SETTING_KEYS.THEME_OVERRIDE);
  } catch {
    // DB might not be ready yet; fall back to system.
    override = undefined;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = override === 'dark' || (override !== 'light' && prefersDark);
  document.documentElement.classList.toggle('dark', useDark);
}

// ─── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  await initDb();
  await applyInitialTheme();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((err) => {
  // If the DB failed to open we still render — in degraded mode — so the
  // user sees something rather than a blank screen.
  console.error('Boot failed:', err);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
