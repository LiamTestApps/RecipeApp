import { NavLink } from 'react-router-dom';
import { cx } from '../lib/utils';

/**
 * Two-tab bottom navigation.
 * Spec 10.2: minimum tap target 48x48; bottom nav for thumb reach.
 *
 * The `Add` action lives in the FAB rather than as a third tab — that
 * keeps the destination tabs reserved for "places you spend time" and
 * the FAB reserved for the primary creation action, which is the
 * Material Design pattern Android users expect.
 */
export default function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className={cx(
        'fixed inset-x-0 bottom-0 z-30',
        'border-t border-stone-200 dark:border-stone-800',
        'bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur',
        'pb-safe',
      )}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        <NavItem to="/" label="Recipes" icon={<RecipesIcon />} end />
        <NavItem to="/settings" label="Settings" icon={<SettingsIcon />} />
      </ul>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={end}
        aria-label={label}
        className={({ isActive }) =>
          cx(
            'flex h-tap flex-col items-center justify-center gap-0.5 py-2',
            'text-xs font-medium transition-colors',
            isActive
              ? 'text-sage-700 dark:text-sage-300'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200',
          )
        }
      >
        {icon}
        <span>{label}</span>
      </NavLink>
    </li>
  );
}

// ─── Icons (inline SVG so we don't add a dep just for two icons) ────────────

function RecipesIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 18.5z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
      <path d="M9 7h7" />
      <path d="M9 11h5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
