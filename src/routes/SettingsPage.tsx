// Spec §5.5 + §6A.2 — API key management, export, import, danger zone.

export default function SettingsPage() {
  return (
    <div className="px-5 pt-12 pb-8">
      <h1 className="text-3xl font-display">Settings</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        API key, theme, import/export, tag manager.
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-4 text-sm text-stone-500 dark:text-stone-400">
        <strong className="font-medium text-stone-700 dark:text-stone-300">
          Next:
        </strong>{' '}
        Implements §5.5 — API key (save/test/remove), theme override toggle,
        export to JSON, import with conflict resolution, tag manager, danger zone.
      </div>
    </div>
  );
}
