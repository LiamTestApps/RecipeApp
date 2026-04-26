import {
  createHashRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

import AppLayout from './layouts/AppLayout';
import HomePage from './routes/HomePage';
import RecipeDetailPage from './routes/RecipeDetailPage';
import RecipeEditPage from './routes/RecipeEditPage';
import StandardisePreviewPage from './routes/StandardisePreviewPage';
import SettingsPage from './routes/SettingsPage';
import NotFoundPage from './routes/NotFoundPage';

// HashRouter rather than BrowserRouter:
//   GitHub Pages serves static files only, so deep-linking to e.g.
//   /recipe/5 by typing it in the address bar would 404 on first load
//   (before the service worker can intercept). Hash routing sidesteps
//   that entirely — the browser only ever asks the server for "/".
//   The price is uglier URLs (`/#/recipe/5`), which is fine for an
//   installed PWA where users rarely see them.

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'recipe/new', element: <RecipeEditPage mode="create" /> },
      { path: 'recipe/:id', element: <RecipeDetailPage /> },
      { path: 'recipe/:id/edit', element: <RecipeEditPage mode="edit" /> },
      {
        path: 'recipe/:id/standardise',
        element: <StandardisePreviewPage />,
      },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const router = createHashRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
