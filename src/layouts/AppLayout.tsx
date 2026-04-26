import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Fab from '../components/Fab';
import UpdatePrompt from '../components/UpdatePrompt';

/**
 * App shell. Holds the persistent chrome (bottom nav, FAB, update toast)
 * and renders the active route through <Outlet />.
 *
 * The FAB is the primary "Add recipe" action and only appears on the home
 * route — putting it on detail/edit/settings pages would be noise.
 */
export default function AppLayout() {
  const location = useLocation();
  const showFab = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      {/*
        Main scrollable region. Bottom padding leaves room for the fixed
        nav (~64px) plus the safe-area inset on Android.
      */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {showFab && <Fab to="/recipe/new" label="Add recipe" />}
      <BottomNav />
      <UpdatePrompt />
    </div>
  );
}
