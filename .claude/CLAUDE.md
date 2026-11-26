# Athenaeum

A private reading app for novels. Users sign in with email + password, upload PDF, EPUB, DOCX or TXT files to their own bookshelf, and read them in a clean, customizable reflowed format modeled on the novel reader at atsu.moe (Atsumaru). There are no social features and no read-aloud. Everything (users, sessions, original files, extracted text, covers, reading progress, settings) is stored in a local PostgreSQL database that runs in Docker on this machine. Each user's data is scoped by `user_id`.

See `PLAN.md` for the build plan and design decisions.

## Stack

npm workspaces monorepo: `client/`, `server/`, `shared/`.

- **client/** (uploads use `XMLHttpRequest` for progress events; tests fake it with `client/src/test/fakeXhr.ts`): React 19 + TypeScript 7 + Vite 8, React Router 8 (`react-router`, data router via `createBrowserRouter`; `RouterProvider` from `react-router/dom`), TanStack Query for API calls, `lucide-react` icons. SCSS (`sass-embedded`, compiled by Vite): design tokens as CSS variables in `styles/tokens.scss`, component styles in SCSS Modules (`*.module.scss`). No Tailwind/UI kit. Fonts self-hosted via `@fontsource*` (Geist is `@fontsource-variable/geist`).
- **server/**: Node 22 + TypeScript + Fastify (`@fastify/multipart` for uploads, `@fastify/cookie`, `@fastify/rate-limit`), run with `tsx` in dev.
    - Database: PostgreSQL 17 through **Drizzle ORM** (`drizzle-orm` + `postgres` driver), with migrations from `drizzle-kit`.
    - Auth: hand-rolled session auth. `@node-rs/argon2` (argon2id) for passwords; random 256-bit session tokens in an HttpOnly, SameSite=Lax cookie; only `sha256(token)` is stored in `sessions`. 30-day sliding expiry.
    - Importers: `pdfjs-dist` (legacy Node build) for PDFs; `jszip` + `linkedom` (XML mode, with `entities` to pre-convert HTML-only entities) for EPUBs. Planned: `mammoth` for DOCX, `TextDecoder` (UTF-8, falling back to windows-1252) for TXT. No sanitizer library: `domToBlocks` builds HTML from an allow-list itself.
- **shared/**: TypeScript types for the API (`Book`, `ChapterSummary`, `Chapter`, `Block`, `Progress`, `ReaderSettings`), used by both sides.
- **Postgres** runs via `docker-compose.yml` (`postgres:17` image, named volume `athenaeum-pg`, bound to `127.0.0.1:5432` only).
- **Tests**: Vitest everywhere. Server integration tests run against a separate `athenaeum_test` database.

## Commands

**Run everything (the normal way):** `docker compose up` (add `-d` to run in the background; `docker compose down` to stop). This starts four services:

- `db`: Postgres
- `deps`: runs `npm ci` into the `athenaeum-node-modules` volume, only when `package-lock.json` has changed
- `server`: runs `tsx watch`. The server applies pending migrations itself on every start (`server/src/index.ts`), including dev reloads
- `client`: Vite

The server and client both run under `docker/supervise.sh`. `deps` deletes `node_modules/.lock-hash` before reinstalling, and the supervisor stops its process until the marker is back. Without this, a running server crashes when packages change (Compose's `depends_on.restart` does not cover this case).

Source is bind-mounted, so edits hot-reload (both watchers poll, because file events don't cross from Windows into containers). The app is at http://localhost:5173. The server port is not published; the client container proxies `/api` to `server:3001`. There is deliberately no Dockerfile: Compose v5's bake builder rejects Dockerfiles when the folder path's letter case differs from disk (`downloads` vs `Downloads`).

**Run on the host instead** (don't run both, since both use port 5173):

```bash
npm run db:up              # only the Postgres container
npm install
npm run db:migrate         # apply Drizzle migrations by hand (the server also does this on start)
npm run dev                # server on :3001 + client on :5173 (Vite proxies /api to the server)
```

**Other commands** (on the host; they need the `db` container running):

```bash
npm test                   # server (against athenaeum_test) + client, one pass
npm run test -w client     # one workspace, watch mode
npm run build              # type-check shared + server, then type-check and build the client
npm run db:generate        # after editing server/src/db/schema.ts, create a migration
npm run db:backup          # (planned, step 8) pg_dump to backups/
npm run user:reset-password -- you@example.com   # prints a temporary password
npm run books:refresh-covers  # recompute every book's cover from its original file
```

The server has no compile step: it runs from TypeScript source with `tsx` (`npm start -w server`), and `build` only type-checks it. Imports use explicit `.ts` extensions (`allowImportingTsExtensions`). The server test setup (`server/src/test/global-setup.ts`) wipes `athenaeum_test` and re-applies migrations before every run. Never point `TEST_DATABASE_URL` at the real database.

After editing `schema.ts`, run `npm run db:generate` and rename the generated file to something descriptive (`0001_<what>.sql`), updating the `tag` in `migrations/meta/_journal.json` to match.

Settings live in `.env` (copy from `.env.example`): `POSTGRES_*` (read by docker-compose), `DATABASE_URL`, `TEST_DATABASE_URL`, `HOST` (default `127.0.0.1`; `0.0.0.0` exposes the app to the LAN), `PORT`, `MAX_UPLOAD_MB`, `ALLOW_SIGNUP`, `APP_ORIGIN` (used for the origin check).

## Project layout

```
docker-compose.yml
shared/src/types.ts
server/src/
  index.ts                   # Fastify bootstrap, binds 127.0.0.1 only
  db/schema.ts, db/client.ts # Drizzle schema + connection
  db/migrations/
  auth/                      # password.ts, session.ts, requireUser hook, origin check
  routes/                    # auth.ts, account.ts, books.ts, chapters.ts, progress.ts, settings.ts, admin.ts
  admin/registry.ts          # describes every schema.ts table for the admin dashboard (from Drizzle metadata)
  importers/                 # index.ts (detects format from bytes), epub.ts, pdf.ts, normalize.ts (DOM → Block[]), errors.ts,
                             # imageSize.ts (picture size from headers), refreshCovers.ts
  scripts/                   # reset-password.ts, refresh-covers.ts
  test/fixtures/             # makeEpub() / makePdf(): build test books in memory, no binary fixtures in the repo
docker/supervise.sh          # restarts server/client in Docker when npm packages are reinstalled
client/src/
  main.tsx, router.tsx, app.test.tsx, structure.test.ts
  api/                       # typed fetch wrappers + TanStack Query hooks
  lib/                       # format.ts (counts, "N books", reading minutes), time.ts, useDocumentTitle, useFileDrop, useFullscreen, useFocusShortcut
  styles/                    # tokens.scss (CSS variables), _mixins.scss (breakpoints + shared patterns), global.scss, stylesheets.test.ts
  components/                # shared UI, one folder per component: Name/Name.tsx + Name.module.scss + Name.test.tsx
    # UI kit: Button (+ButtonLink, ButtonAnchor), CloseButton, SearchField, SegmentedControl, TextField, FormError,
    #         EmptyState, PageSkeleton, Spinner, PageHeading, CardGrid, Tabs, ProgressBar, Modal,
    #         Menu (icon button + dropdown of actions; `look="overlay"` on covers, `danger` items)
    # Book pieces: BookCover, GeneratedCover, BookDetails/ (book page + collection tabs), CollectionDialog/ (create + edit)
    # App shell: AppLayout, Header, AccountMenu, StatusBanner, NotFoundPage, UploadProvider (useUploads), UploadButton ("Add book": opens the file picker), UploadPanel
    # Self-contained action buttons (no props; each opens its own flow): UploadButton, CreateCollectionButton (+ its private CreateCollectionDialog/)
  features/                  # one folder per feature; every component in it has its own subfolder (shelf/BookCard/BookCard.tsx)
    auth/                    # AuthPage, AuthForm, PasswordField, AuthModeSwitch, ResetPasswordHint, RequireAuth, GuestOnly
    shelf/                   # ShelfPage, BookCard, BookCardMenu ("…" on the cover → Delete), CollectionsSection, CollectionCard, CollectionCoverMosaic, DropOverlay
    book/                    # BookPage
    collections/             # CollectionPage, CollectionActions, CollectionBookTabs, CollectionBookPanel, EditCollectionDialog, BackToShelfLink
    admin/                   # AdminPage (/admin, lazy-loaded): a Firestore-console layout, AdminBreadcrumbs over three Panes:
                             # TablesPane | RowsPane (RowFilters, RowList, Pager) | RowPane (FieldList, FieldValue, "Row actions" Menu).
                             # TableBrowser owns the rows query + actions; PaneLink is a list entry; EditRowDialog, RowField,
                             # CheckboxField, SelectField, ReadOnlyField, PasswordResetDialog.
                             # adminCells.ts (display/form helpers), adminView.ts (?table=&q=&sort=&dir=&page=&row= URL state)
    reader/                  # ReaderPage, ReaderToolbar, ChapterView, ChapterHeader, ChapterBody, ChapterNotes, ChapterPager, ChapterGallery, GalleryButton, GalleryGrid, ImageViewer, ChapterDrawer(+Item),
                             # useReadingProgress, useChapterArrowKeys, usePrefetchNextChapter, readerStyle.ts
```

## Conventions

- Strict TypeScript on both sides. API request/response types come from `shared/` and are never redeclared.
- **Parsing happens on the server.** The client uploads the raw file; the server parses it, stores everything in one transaction, and returns the new book. The client only ever renders the normalized `Block[]` shape (`{type: 'p'|'h'|'hr'|'img'|'note', ...}`), never raw EPUB/PDF HTML.
    - A paragraph's optional `html` is built by `domToBlocks` from an allow-list (em, strong, i, b, sup, sub, small, u, s, br) with escaped text and no attributes. That is why the reader can use `dangerouslySetInnerHTML`. Never put markup into `html` any other way.
    - Importers throw `ImportError(message, 415|422)`. The message is shown to the user as-is.
    - Importers are developed test-first with fixtures from `server/src/test/fixtures`. When a real book imports badly, add a fixture test reproducing it before fixing it.
    - PDF footnotes: a raised small number is folded back into its line as `<sup>`; the numbered small-type lines at the foot of a page become `note` blocks, placed after the paragraph that cites them and moved to the end of that chapter (the reader lists them in `ChapterNotes`).
    - PDF paragraphs: line spacing is the smallest _common_ gap between lines (not the median, which in dialogue-heavy novels is the paragraph gap), and a paragraph that opens with a box bracket (`「 『 【 [ 〈 《`) ends where that bracket closes.
    - PDF illustrations: embedded pictures (not small ornaments, not ones repeated on 3+ pages) are re-encoded as JPEGs and listed in the `gallery` of the chapter whose text comes before them (`chapters.gallery`, `Chapter.gallery`); they are not put in the text. The reader shows them via `ChapterGallery` (corner button → grid → `ImageViewer`).
    - Covers: an EPUB's declared cover, else the book's first picture in reading order. A PDF's cover is its first illustration (so it fills the card instead of showing a white page); a PDF with no pictures gets page 1 rendered with pdf.js + `@napi-rs/canvas` (pdf.js's optional dependency; its Linux musl build is in the lockfile for Docker). Small ornaments never become covers (`importers/imageSize.ts`, same limits as PDF illustrations). An EPUB with no pictures has no cover, and the client shows `GeneratedCover`.
    - After changing the cover rules, run `npm run books:refresh-covers` to recompute existing books' covers from their stored original files (progress is kept).
- **Reader URLs are 1-based**: `/read/:bookId/:chapterNumber`. Every rendered block carries `data-block={index}`, which is what scroll tracking and position restore use.
- All DB access goes through Drizzle in `server/src/db` and the route handlers. No raw SQL strings except inside migrations.
- **Every book-related query must filter by the signed-in user** (`books.user_id = req.user.id`, or a join through `books` for child tables). A book that belongs to someone else returns 404, never 403. Every new route needs a test that a second user can't reach the first user's data.
- All new routes require a session: add `{ preHandler: requireUser }` (from `server/src/auth/plugin.ts`) and read the user from `req.user`. Only `/api/health`, `/api/auth/*` are public. `GET /api/auth/me` returns 200 with `{ user: null }` when signed out, not 401, so the browser console stays clean.
- The auth plugin runs on every request. It sets `req.user` / `req.sessionId` from the cookie, renews sessions with under 15 days left, and rejects any non-GET/HEAD/OPTIONS request whose `Origin` isn't `APP_ORIGIN` (`localhost` and `127.0.0.1` are treated as the same). Server tests must send `headers: sameOrigin` / `withSession(token)` from `server/src/test/helpers.ts`; use `uniqueEmail()` because the test DB is shared across files.
- Client: `useMe()` (in `client/src/api/auth.ts`) is the source of truth for who's signed in. Pages that need an account go under `<RequireAuth>` in `router.tsx`. Any 401 from another API call clears `me`, which sends the user to `/login?next=...`. When clearing cached data on login/logout, never remove the `me` query (the header subscribes to it); overwrite it instead. Client tests fake the API with `mockApi` / `mockSignedIn` from `client/src/test/render.tsx`.
- **Admin dashboard (`/admin`)**: browse, search, sort, edit and delete rows of any table, and reset a user's password. Laid out like the Firestore console (tables | rows | the open row's `name: value` fields); on phones only the deepest pane in the URL shows and the breadcrumb leads back. The header's shelf search is hidden there (`AppLayout`). Admins are users with `users.is_admin = true` (set it in the dashboard or with SQL). `is_admin` is loaded into `req.user` on every request but is never sent to the client (not in `/auth/me`). Every `/api/admin/*` route uses `requireAdmin` (`server/src/auth/plugin.ts`), which answers anyone else, signed in or not, with Fastify's own "route not found" 404, and the page then shows the ordinary "Page not found". Nothing in the app links to `/admin`. New tables in `schema.ts` must be added to `TABLES` in `server/src/admin/registry.ts`; `users.password_hash` is never read or sent; primary keys, `bytea` and `jsonb` columns are read-only. An admin can't delete their own account or remove their own admin flag there.
- Never log passwords, session tokens, or cookie headers. Login errors are generic ("Invalid email or password").
- Reader settings are CSS variables on the reader root (`--r-font`, `--r-size`, `--r-line-height`, `--r-measure`, ...). Changing a setting means changing a variable, not re-rendering text.
- Colors and spacing come from the CSS variables in `client/src/styles/tokens.scss`. Don't hard-code hex values anywhere else (`stylesheets.test.ts` fails on them). Sass variables and mixins are only for compile-time things.
- Styles are SCSS. Each component/page imports its own `Name.module.scss` (`import styles from './Name.module.scss'`); only `styles/global.scss` is global (imported once in `main.tsx`). Share partials with `@use '../../styles/mixins' as *;` (`below(xs|sm|md|lg)` for the 480/560/640/720px breakpoints, `reduced-motion`, `ellipsis`, `eyebrow`, `bare-input`, `segmented`), never `@import`. Nest at most 3 levels; keep class names camelCase. Put declarations before any `@include` whose mixin contains nested rules, or Sass warns (the test fails on warnings). Keep each file's `@media` blocks where the cascade needs them (usually at the end) rather than nesting them into each rule.
- **Pages are composed from components.** A page file is route params + data hooks, then loading/error/empty states (`PageSkeleton`, `EmptyState`), then one `return` of named components. Markup with its own state, markup that repeats, or a block over ~30 lines becomes its own component, named for what it shows (`ChapterPager`, `CollectionBookTabs`). One component per file; plain helpers (formatters, sorters) may share a file.
- Use the UI kit instead of raw elements + class names: `Button variant="primary|secondary|danger|icon|text"` (`ButtonLink` for router links, `ButtonAnchor` for downloads), `TextField`, `SearchField`, `SegmentedControl`, `Tabs`, `EmptyState`, `PageSkeleton`, `Spinner`, `PageHeading`, `CardGrid`, `ProgressBar`, `CloseButton`, `FormError`, `BookCover`. There are no global `.btn` classes. Callers never build class strings for these; variants are props.
- **No item lists inside JSX.** Lists passed as props (menu `items`, `options`, tabs) are never written inline in the markup (`items={[{ ... }]}`) or built there (`items={books.map(...)}`). Build them in a named constant above the `return` (`const items: MenuItem[] = [...]`, then `items={items}`), or as a module constant if they never change (`ORDER_OPTIONS`). An item with an icon or 3+ properties is written one property per line; a plain two-property pair like `{ value: 'all', label: 'All' }` may stay on one line.
- **Every component lives in its own folder named after it**, holding `Name.tsx`, `Name.module.scss` and `Name.test.tsx` (if it has one). That includes pages and feature parts (`features/collections/CollectionActions/CollectionActions.tsx`) and the private parts of a shared component, as subfolders of it (`components/BookDetails/ChapterList/ChapterList.tsx`). Hooks and plain helpers stay as files in the feature folder (`reader/useReadingProgress.ts`, `collections/collectionSort.ts`), and route-level tests stay there too, in lowercase (`collections/collections.test.tsx`, `src/app.test.tsx`). `src/structure.test.ts` fails if a PascalCase file isn't in its own folder. Import files directly (`../Header/Header.tsx`); there are no `index.ts` barrel files.
- Features import from `components/`, `api/`, `lib/` and their own folder, never from another feature; something two features need moves to `components/`. Components never import from `features/`.
- Privacy: the server listens on `HOST` (127.0.0.1 by default), the DB port is always bound to localhost, and there are no external network calls (no CDNs, analytics, or remote fonts). Never commit `.env`.
- Tests sit next to the code they cover (`foo.test.ts`). Importer logic (paragraph joining, chapter detection, EPUB spine/TOC parsing, DOCX headings, TXT encoding) and each API route must have tests.

## Design reference

- UI font: Geist. Page background `#1D1E20`, body text `#B8BCC0`, headings `#F9F8F6`, raised surfaces/inputs `#313234`, radius 12px, accent purple (about `#7765E3`)
- Header 80px tall, content width 1200px, 20px gutter
- Reader text: serif stack `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`, 18px, line-height 1.6, 16px paragraph spacing, measure about 66ch, centered column, bold 20px chapter title with a "N words · M min" line under it
- Reader themes (bg / text): Site `#1D1E20/#B8BCC0`, Dim `#1A1917/#9D968B`, Sepia `#F4ECD8/#4A3F35`, Light `#FBFBFA/#2B2B2B`, Day `#E8E6E1/#3A3A38`, Night `#12161B/#A3B1BD`
