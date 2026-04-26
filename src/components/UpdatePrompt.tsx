import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Listens to the service worker's "new version available" signal and
 * shows a small toast at the top of the viewport.
 *
 * Spec 4.2: "An 'Update available' toast is shown when a new version is
 * deployed, with a 'Reload' button."
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Periodically poll for updates while the app is open.
      if (reg) {
        setInterval(() => reg.update(), 60 * 60 * 1000); // hourly
      }
    },
  });

  // Slide-in animation gate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (needRefresh) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
    return;
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[90%]
        rounded-full bg-stone-900 dark:bg-sage-700 text-stone-50
        px-4 py-2 shadow-xl text-sm
        transition-all duration-200
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="flex items-center gap-3">
        <span>Update available</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="font-medium underline underline-offset-2"
        >
          Reload
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
