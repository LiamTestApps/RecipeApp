import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getSetting,
  setSetting,
  deleteSetting,
  listAllTags,
  getRecipeCountForTag,
  renameTag,
  deleteTag,
  SETTING_KEYS,
} from '../db';
import { testApiKey } from '../lib/gemini';
import {
  exportToJson,
  downloadBackup,
  importFromJson,
  deleteAllData,
  type ImportResult,
} from '../lib/backup';
import ConfirmDialog from '../components/ConfirmDialog';
import { capitalise, cx } from '../lib/utils';

type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Settings page (spec §5.5 + §6A.2 + §9).
 *
 * Sections, in order:
 *   1. AI / Gemini API key — paste, test, save, remove
 *   2. Appearance — theme override
 *   3. Data — export to JSON, import from JSON
 *   4. Tags — rename / delete
 *   5. Danger zone — wipe everything
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-md">
      <header className="px-5 pt-10 pb-4">
        <h1 className="font-display text-3xl">Settings</h1>
      </header>

      <div className="px-5 pb-8 space-y-8">
        <ApiKeySection />
        <AppearanceSection />
        <DataSection />
        <TagSection />
        <DangerZoneSection />
      </div>
    </div>
  );
}

// ─── 1. API key ──────────────────────────────────────────────────────────────

function ApiKeySection() {
  const stored = useLiveQuery(() => getApiKey(), []);
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'remove'>(null);
  const [status, setStatus] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  // Whenever the saved key changes (initial load, after save), reset draft.
  useEffect(() => {
    if (stored !== undefined) setDraft(stored ?? '');
  }, [stored]);

  const isLoading = stored === undefined;
  const saved = stored ?? '';
  const isDirty = draft !== saved;

  const masked = (k: string) =>
    k.length <= 8 ? '••••••••' : `${k.slice(0, 4)}••••${k.slice(-4)}`;

  const handleSave = async () => {
    setBusy('save');
    setStatus(null);
    try {
      const trimmed = draft.trim();
      if (!trimmed) {
        setStatus({ kind: 'error', text: 'Paste a key first.' });
        return;
      }
      await setApiKey(trimmed);
      setStatus({ kind: 'success', text: 'Saved.' });
    } catch {
      setStatus({ kind: 'error', text: 'Could not save.' });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy('test');
    setStatus(null);
    try {
      const ok = await testApiKey(draft || saved);
      setStatus(
        ok
          ? { kind: 'success', text: 'Key works.' }
          : { kind: 'error', text: 'Key was rejected by Google.' },
      );
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach Google.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    setBusy('remove');
    setStatus(null);
    try {
      await clearApiKey();
      setDraft('');
      setStatus({ kind: 'success', text: 'Key removed.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="AI features" subtitle="Power Smart Extract and Standardise.">
      <p className="text-sm text-stone-600 dark:text-stone-400 mb-3">
        Add a free Gemini API key from{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-sage-700 dark:text-sage-400"
        >
          Google AI Studio
        </a>
        . The key is stored only on this device.
      </p>

      <div className="space-y-2">
        <div className="relative">
          <input
            type={reveal ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={saved ? masked(saved) : 'Paste API key'}
            aria-label="Gemini API key"
            disabled={isLoading || busy !== null}
            className={inputCx + ' pr-12'}
          />
          <button
            type="button"
            onClick={() => setReveal(!reveal)}
            aria-label={reveal ? 'Hide key' : 'Show key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null || !isDirty || draft.trim() === ''}
            className={primaryBtnCx(busy !== null || !isDirty || draft.trim() === '')}
          >
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={busy !== null || (draft.trim() === '' && saved === '')}
            className={secondaryBtnCx(busy !== null || (draft.trim() === '' && saved === ''))}
          >
            {busy === 'test' ? 'Testing…' : 'Test'}
          </button>
          {saved && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy !== null}
              className="px-4 py-2 rounded-full text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>

        {status && (
          <p
            role="alert"
            className={cx(
              'text-sm rounded-xl p-3 mt-2 border',
              status.kind === 'success'
                ? 'text-sage-800 dark:text-sage-200 bg-sage-50 dark:bg-sage-950/40 border-sage-200 dark:border-sage-900/50'
                : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50',
            )}
          >
            {status.text}
          </p>
        )}
      </div>
    </Section>
  );
}

// ─── 2. Appearance ───────────────────────────────────────────────────────────

function AppearanceSection() {
  const stored = useLiveQuery(() => getSetting(SETTING_KEYS.THEME_OVERRIDE), []);

  const current: ThemeMode =
    stored === 'light' ? 'light' : stored === 'dark' ? 'dark' : 'system';

  const setMode = async (mode: ThemeMode) => {
    if (mode === 'system') {
      await deleteSetting(SETTING_KEYS.THEME_OVERRIDE);
    } else {
      await setSetting(SETTING_KEYS.THEME_OVERRIDE, mode);
    }
    applyTheme(mode);
  };

  return (
    <Section title="Appearance">
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-3 gap-2"
      >
        <ThemeOption label="System" value="system" current={current} onSelect={setMode} />
        <ThemeOption label="Light" value="light" current={current} onSelect={setMode} />
        <ThemeOption label="Dark" value="dark" current={current} onSelect={setMode} />
      </div>
    </Section>
  );
}

function ThemeOption({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: ThemeMode;
  current: ThemeMode;
  onSelect: (v: ThemeMode) => void;
}) {
  const active = current === value;
  return (
    <button
      role="radio"
      aria-checked={active}
      type="button"
      onClick={() => onSelect(value)}
      className={cx(
        'h-tap rounded-xl text-sm font-medium border transition-colors',
        active
          ? 'border-sage-500 bg-sage-100 dark:bg-sage-900/40 text-sage-800 dark:text-sage-200'
          : 'border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-900',
      )}
    >
      {label}
    </button>
  );
}

/** Apply theme by toggling the .dark class on <html>. Mirrors main.tsx logic. */
function applyTheme(mode: ThemeMode) {
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (mode === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefers);
  }
}

// ─── 3. Data: import / export ────────────────────────────────────────────────

function DataSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'busy' }
    | { kind: 'done'; result: ImportResult }
    | { kind: 'error'; text: string }
  >({ kind: 'idle' });

  const handleExport = async () => {
    const backup = await exportToJson();
    downloadBackup(backup);
  };

  const handleImportClick = () => {
    setImportStatus({ kind: 'idle' });
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file twice still fires
    if (!file) return;

    setImportStatus({ kind: 'busy' });
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await importFromJson(json);
      setImportStatus({ kind: 'done', result });
    } catch (err) {
      setImportStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Import failed.',
      });
    }
  };

  return (
    <Section title="Backup & restore">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className={secondaryBtnCx(false)}
        >
          Export to file
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          disabled={importStatus.kind === 'busy'}
          className={secondaryBtnCx(importStatus.kind === 'busy')}
        >
          {importStatus.kind === 'busy' ? 'Importing…' : 'Import from file'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {importStatus.kind === 'done' && (
        <p
          role="status"
          className="mt-3 text-sm rounded-xl p-3 border text-sage-800 dark:text-sage-200 bg-sage-50 dark:bg-sage-950/40 border-sage-200 dark:border-sage-900/50"
        >
          Added {importStatus.result.added} recipe
          {importStatus.result.added === 1 ? '' : 's'}.
          {importStatus.result.skipped > 0 && (
            <>
              {' '}Skipped {importStatus.result.skipped} duplicate
              {importStatus.result.skipped === 1 ? '' : 's'}
              {importStatus.result.skippedTitles.length <= 3
                ? `: ${importStatus.result.skippedTitles.join(', ')}.`
                : '.'}
            </>
          )}
        </p>
      )}
      {importStatus.kind === 'error' && (
        <p
          role="alert"
          className="mt-3 text-sm rounded-xl p-3 border text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50"
        >
          {importStatus.text}
        </p>
      )}

      <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
        Importing skips recipes whose title already exists.
      </p>
    </Section>
  );
}

// ─── 4. Tag manager ──────────────────────────────────────────────────────────

function TagSection() {
  const tags = useLiveQuery(() => listAllTags(), []) ?? [];

  return (
    <Section title="Tags" subtitle={`${tags.length} tag${tags.length === 1 ? '' : 's'}`}>
      {tags.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No tags yet. Add tags when creating a recipe.
        </p>
      ) : (
        <ul className="space-y-1">
          {tags.map((t) => (
            <TagRow key={t.id} id={t.id!} name={t.name} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function TagRow({ id, name }: { id: number; name: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const count = useLiveQuery(() => getRecipeCountForTag(id), [id]);

  const handleSave = async () => {
    const next = draft.trim().toLowerCase();
    if (next && next !== name) {
      try {
        await renameTag(id, next);
      } catch {
        // Probably a unique-name collision. Silently revert.
        setDraft(name);
      }
    } else {
      setDraft(name);
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    setConfirmRemove(false);
    await deleteTag(id);
  };

  return (
    <li className="flex items-center gap-2 py-1">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraft(name);
              setEditing(false);
            }
          }}
          aria-label="Rename tag"
          className="flex-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 text-sm outline-none focus:border-sage-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-sm py-1.5 px-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-900"
        >
          <span className="capitalize">{capitalise(name)}</span>
          <span className="text-xs text-stone-400 ml-2">
            {count !== undefined && `${count} recipe${count === 1 ? '' : 's'}`}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmRemove(true)}
        aria-label={`Delete tag ${name}`}
        className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M4 4l1 8a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-8" />
        </svg>
      </button>

      <ConfirmDialog
        open={confirmRemove}
        title={`Delete tag "${capitalise(name)}"?`}
        message={
          count !== undefined && count > 0
            ? `This tag is used on ${count} recipe${count === 1 ? '' : 's'}. The recipes themselves will not be deleted, just untagged.`
            : 'This tag will be removed.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmRemove(false)}
      />
    </li>
  );
}

// ─── 5. Danger zone ──────────────────────────────────────────────────────────

function DangerZoneSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleWipe = async () => {
    setBusy(true);
    try {
      await deleteAllData();
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Danger zone">
      <p className="text-sm text-stone-600 dark:text-stone-400 mb-3">
        Permanently delete every recipe and tag on this device. Your API key
        and theme preference are kept.
      </p>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="px-4 py-2 rounded-full text-sm font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        Delete all data
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete everything?"
        message="Every recipe, tag, and standardisation flag will be permanently removed. Export a backup first if you want to keep them."
        confirmLabel={busy ? 'Deleting…' : 'Delete all'}
        destructive
        onConfirm={handleWipe}
        onCancel={() => setConfirmOpen(false)}
      />
    </Section>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="font-display text-xl">{title}</h2>
        {subtitle && (
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

const inputCx =
  'w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-sage-500 dark:focus:border-sage-400 placeholder:text-stone-400 dark:placeholder:text-stone-500';

const primaryBtnCx = (disabled: boolean) =>
  cx(
    'px-4 py-2 rounded-full text-sm font-medium',
    disabled
      ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
      : 'bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950',
  );

const secondaryBtnCx = (disabled: boolean) =>
  cx(
    'px-4 py-2 rounded-full text-sm font-medium border border-stone-300 dark:border-stone-700',
    disabled
      ? 'opacity-50 cursor-not-allowed'
      : 'hover:bg-stone-100 dark:hover:bg-stone-800',
  );
