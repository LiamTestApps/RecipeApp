# Recipe Book

A personal recipe book PWA. Offline-first, no backend, all data in IndexedDB.

## Stack

React 18 · Vite · TypeScript · Tailwind v4 · Dexie · React Router (Hash) · vite-plugin-pwa.

## Local development

```bash
npm install
npm run dev       # starts on http://localhost:5173
npm run build     # production build into ./dist
npm run preview   # serve the production build locally
npm run typecheck # tsc --noEmit
```

## Deployment

Push to `main`. The GitHub Action at `.github/workflows/deploy.yml` builds and publishes to Pages.

The deployed site will live at:

> https://liamtestapps.github.io/RecipeApp/

(GitHub lowercases the username portion of Pages URLs.)

The `base` path in `vite.config.ts` is set to `/RecipeApp/` to match. If you ever rename the repo, update that constant or every asset will 404.

## Project map

```
src/
  db/
    schema.ts   ← Dexie schema, version, settings keys
    queries.ts  ← all CRUD; UI never touches Dexie directly
    index.ts
  types/        ← Recipe, Ingredient, Step, Tag, RecipeDraft, etc.
  lib/
    colors.ts   ← title-hash → hero color
    utils.ts    ← cx, formatTime, normalise, capitalise
  layouts/
    AppLayout.tsx
  components/
    BottomNav.tsx
    Fab.tsx
    UpdatePrompt.tsx
  routes/
    HomePage.tsx
    RecipeDetailPage.tsx
    RecipeEditPage.tsx
    StandardisePreviewPage.tsx
    SettingsPage.tsx
    NotFoundPage.tsx
  App.tsx       ← route definitions
  main.tsx      ← theme + DB bootstrap
  index.css     ← Tailwind + theme tokens
```

## Schema versioning

`DB_VERSION` lives in `src/db/schema.ts`. Bump it whenever the schema changes and add an `.upgrade()` callback. Destructive upgrades are forbidden.
