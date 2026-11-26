# Athenaeum: Build Plan

## What we're building

A private web app for reading your own novels. You sign in with your email and a password, upload PDF, EPUB, Word (.docx) or .txt files, and they land on **your** bookshelf. You read them in the same clean, adjustable format as the atsu.moe novel reader.

Everything is stored in a **PostgreSQL database running on your own computer** (in Docker) and belongs to the signed-in account: the original files, the extracted text, covers, reading progress, and reader settings. Each person who signs in sees only their own books. There are no comments, ratings, or Discord, and nothing is sent to outside services.

## What I found on atsu.moe

I opened the home page, a novel's detail page, and a chapter with the reader settings panel open.

| atsu.moe screen | What Athenaeum keeps | What gets dropped |
|---|---|---|
| **Home**: dark header (logo, search with a Ctrl K hint, **Login / Sign up** links), "Hot Updates" grid of rounded cover cards with title + "2h ago" | **Bookshelf**: same header with the same Login / Sign up links. When you're signed in, they become an account menu. Same grid, shown as "Continue Reading" plus "All Books", with a progress bar on each card | Discord, ratings, view counts |
| **Novel page**: big serif title, cover on the left with a purple "Continue" button, tag chip, Type/Status/Author row, synopsis, chapter list with Overview/All/Read/Unread tabs, sort arrows, and a checkbox per row | **Book page**: same layout. Type = PDF/EPUB/DOCX/TXT, Author, chapter/word count, description (when the file has one), chapter list with read/unread filters, sort, and mark-as-read checkboxes. Rate is dropped; Bookmark becomes "Edit details / Download original / Delete" | Comments, rate, views |
| **Reader**: centered serif column, chapter title + "944 words · 4 min", a vertical icon toolbar on the right edge | **Reader**: same column and title block. Toolbar: Settings, Fullscreen, Book info, Home | Comments, per-paragraph comment and listen buttons, read-aloud |
| **Settings panel** (slides in from the right): Settings and Chapters tabs, prev/next chapter control, Theme (Site, Dim, Sepia, Light, Day, Night), Font (Serif, Georgia, Geist Serif, Sans, Lucida, Legible), sliders for Size 14–28px, Weight, Line height 1.4–2.2, Line width 40–100 chars, Letter spacing 0–2px, Paragraph spacing 4–40px, Justify / Indent toggles, Progress indicator (Percent / Chapter), Continuous scroll | **All of it**, with the same ranges and defaults. Settings are saved to your account, so they follow you to any browser where you sign in | Comments tab, chapter-comments options, voice/speed (read-aloud) |

## Features

1. **Accounts**
   - **Sign up** with email + password (minimum 8 characters), and **Sign in** / **Sign out**. These pages use atsu-style centered cards on the dark background.
   - Every page except sign-in and sign-up requires an account. If you're signed out, you're sent to sign in, then returned to the page you wanted.
   - You stay signed in for 30 days, and each visit extends that.
   - **Account page**: change email, change password, sign out of all devices, delete your account (and all your books, after a confirmation).
   - **Forgot password:** there's no email server, so the app can't send reset emails. Instead, run `npm run user:reset-password -- you@example.com` on the computer running the app. It prints a temporary password.
   - Set `ALLOW_SIGNUP=false` in `.env` after you've made your accounts, to stop anyone else from signing up.
2. **Upload**
   - "Add book" button in the header, plus drag-and-drop anywhere on the shelf. Several files at once is fine.
   - The file goes to the local server, which parses it and saves the result to Postgres under your account in one step. If anything fails, nothing half-imported is left behind.
   - **EPUB**: read the spine and table of contents, so chapters and titles come straight from the book. Pull out the title, author, description, cover image, and illustrations. With no declared cover, the first real picture in reading order (not a small ornament) becomes the cover.
   - **PDF**: extract text with pdf.js and rebuild real paragraphs from the line fragments (join wrapped lines, fix hyphenation, drop page numbers and repeated headers/footers). The cover is the first picture in the book (the art itself, so it fills the card); a PDF with no pictures gets a render of page 1.
   - **Word (.docx)**: convert with `mammoth`, which keeps headings, italics, bold, and images. Chapters split on the document's Heading 1 / Heading 2 styles. Title and author come from the document properties.
   - **Text (.txt)**: paragraphs split on blank lines (or on single line breaks if the file has no blank lines). Read as UTF-8, falling back to Windows-1252 for older files.
   - **Chapter detection** for PDF, DOCX and TXT, in this order: the file's own outline or heading styles, then lines like "Chapter 12" / "Prologue" / "Epilogue", then fixed chunks of about 3,000 words.
   - A progress indicator while a big file uploads and imports, and a clear error if a PDF has no text layer (scanned images).
   - The original file is kept in the database, so you can download it later from the book page.
   - You can edit the title and author afterwards.
3. **Bookshelf**
   - Cover grid like the atsu home page: rounded corners, a format chip on the cover (PDF / EPUB / DOCX / TXT where atsu shows Manga/Novel), a percent-read badge, title, and "last read 2h ago".
   - A "Continue Reading" row on top and "All Books" below. Sort by recently read, recently added, or title. The header search filters the shelf (Ctrl K focuses it).
   - Books without a cover get a generated typographic cover. Covers fill the card's whole 2:3 cover area (`object-fit: cover`).
4. **Book page**: the atsu novel-page layout described above.
5. **Reader**
   - Renders the normalized chapter text in the atsu column style. Every setting in the panel above is backed by CSS variables, so changes apply instantly.
   - Chapters tab in the panel (searchable list, current chapter highlighted), prev/next buttons, and the ← / → keys to change chapters.
   - **Continuous scroll** (on: chapters load one after another as you scroll; off: one chapter per page with Next/Prev at the bottom).
   - Remembers your exact position (chapter + paragraph). Progress is saved to your account a couple of seconds after you stop scrolling and when you leave the page, and restored when you reopen the book on any device. Chapters you finish get marked read automatically.
   - A thin progress indicator showing either book percent or "Chapter 12 / 80".
   - Fullscreen toggle. Esc closes the panel.
6. **Admin dashboard** (added 2026-11-23): `/admin`, reached only by typing the URL, shows "Page not found" unless you're an admin. Tabs for every table with row counts. Each table can be searched (text and ids), sorted by any column, and paged. You can edit a row in a dialog (only changed values are sent), delete a row, follow an id to the row it points to, and give a user a temporary password (replaces `npm run user:reset-password` for day-to-day use).
7. **UI**: Geist font, dark palette, 12px radii, and purple accent, all measured from the site (values are in .claude/CLAUDE.md). It works on a phone: the grid collapses to 2 columns, and the settings panel becomes a bottom sheet.

## Architecture

```
 Browser (React client, :5173)                 Node server (Fastify, :3001)                  PostgreSQL 17 (Docker, :5432)
 ┌──────────────────────────┐                  ┌────────────────────────────────┐           ┌──────────────────────────┐
 │ Sign in / Sign up        │  session cookie  │ auth: sessions, argon2 hashes  │           │ users, sessions          │
 │ Upload dialog            │ ── raw file ───► │ importers/ epub|pdf|docx|txt   │           │ books (user_id)          │
 │ Shelf / Book / Reader    │                  │        └► normalize.ts         │ ───────►  │ book_files (original)    │
 │ Settings panel           │ ◄── JSON ─────── │ routes: auth, books, chapters, │ ◄───────  │ chapters (blocks jsonb)  │
 └──────────────────────────┘                  │ progress, settings, account    │  Drizzle  │ progress, chapter_reads  │
                                               │ every query filtered by user   │           │ user_settings            │
                                               └────────────────────────────────┘           └──────────────────────────┘
```

**Why parse on the server?** The original file has to reach the database anyway, so one upload does both jobs. It also keeps the heavy PDF/EPUB/DOCX libraries out of the browser bundle and puts the importer logic behind one tested function.

**Why build our own EPUB parser instead of using epub.js?** epub.js renders the book's own HTML and CSS inside an iframe, so the book's styles fight our typography settings. Taking the text out and rendering it ourselves is what gives every book the identical atsu look, and that's the point of this app.

**Why reflow PDFs?** A PDF is a fixed page layout. Showing the pages as-is would just be another PDF viewer with the formatting you don't like. Reflowing loses images and fancy layout, but it gives the clean column for text-heavy novels.

### How sign-in works

I'm writing the sign-in code myself (about 200 lines) instead of using an auth library, so it's simple and has nothing external to set up.

- **Passwords** are hashed with argon2id (`@node-rs/argon2`). The plain password is never stored or logged.
- **Sessions:** signing in creates a random 256-bit token. The browser keeps it in an `HttpOnly`, `SameSite=Lax` cookie that page scripts can't read. The database stores only a SHA-256 hash of the token, so a stolen database copy can't be used to log in.
- **Cross-site requests:** any request that changes data must come from the app's own origin, or it's rejected. This blocks other websites from acting on your account.
- **Login limits:** login and sign-up are rate-limited (`@fastify/rate-limit`, 10 attempts per 15 minutes per IP). A wrong email and a wrong password give the same error, so the form doesn't reveal which emails have accounts.
- **Ownership:** every book route checks that the book belongs to the signed-in user. Someone else's book returns 404 (not 403), so its existence isn't revealed. Images and cover URLs are checked the same way.

### Database tables

| Table | Columns |
|---|---|
| `users` | `id` uuid pk, `email` (unique, stored lowercase), `password_hash`, `is_admin` (default false), `created_at` |
| `sessions` | `id` = sha256(token) pk, `user_id` → users (cascade), `expires_at`, `created_at`, `user_agent` |
| `books` | `id` uuid pk, `user_id` → users (cascade), `title`, `author`, `description`, `format` (`epub`/`pdf`/`docx`/`txt`), `cover` bytea, `cover_mime`, `chapter_count`, `word_count`, `added_at`, `last_read_at`; index on (`user_id`, `last_read_at`) |
| `book_files` | `book_id` pk → books (cascade), `filename`, `mime`, `size_bytes`, `data` bytea |
| `chapters` | `id` pk, `book_id` → books (cascade), `index`, `title`, `word_count`, `blocks` jsonb; unique (`book_id`, `index`) |
| `book_images` | `id` pk, `book_id` → books (cascade), `mime`, `data` bytea (EPUB/DOCX illustrations; image blocks point to these) |
| `progress` | `book_id` pk → books (cascade), `chapter_index`, `block_index`, `percent`, `updated_at` |
| `chapter_reads` | (`book_id`, `chapter_index`) pk, `read_at` |
| `collections` | `id` uuid pk, `user_id` → users (cascade), `name`, `created_at`; unique (`user_id`, lower(`name`)) |
| `collection_books` | (`collection_id`, `book_id`) pk, both cascade, `added_at` (when the book was put in the collection) |
| `user_settings` | `user_id` pk → users (cascade), `reader` jsonb (theme, font, size, weight, line height, width, spacing, toggles) |

Deleting a user removes all of their books, files, and progress through the cascades.

The original files are stored in Postgres as `bytea`, as you asked, rather than in a folder on disk. For novel-sized files (a few MB) that works fine. The upload limit defaults to 200 MB per file. Large binary columns are never selected in list queries: the shelf fetches covers through `/api/books/:id/cover`, and chapter text is only loaded one chapter at a time.

### API

Every route except signup/login/health requires a session.

```
POST   /api/auth/signup                 { email, password } → creates user + session cookie
POST   /api/auth/login                  { email, password } → session cookie
POST   /api/auth/logout                 ends this session
GET    /api/auth/me                     { user } or { user: null } when signed out (always 200)
PATCH  /api/account                     change email / password (requires current password)
POST   /api/account/logout-all          ends every session for this user
DELETE /api/account                     delete account + all data (requires current password)

GET    /api/books                       your shelf (no file/cover bytes)
POST   /api/books                       multipart upload → parse → store → returns Book
GET    /api/books/:id                   book detail + chapter list (titles, word counts, read flags)
PATCH  /api/books/:id                   edit title/author
DELETE /api/books/:id                   delete book (cascades to everything)
GET    /api/books/:id/cover             cover image
GET    /api/books/:id/file              download original
GET    /api/books/:id/chapters/:index   one chapter's blocks
GET    /api/books/:id/images/:imageId   embedded illustration
GET/PUT /api/books/:id/progress         reading position
PUT    /api/books/:id/chapters/:index/read   mark read / unread
GET/PUT /api/settings                   your reader settings

GET    /api/collections                 your collections (name, book count, up to 4 preview books), A–Z
POST   /api/collections                 { name, bookIds } → new collection (409 if the name is taken)
GET    /api/collections/:id             collection + its books, most recently added first
PATCH  /api/collections/:id             { name } rename
PUT    /api/collections/:id/books       { bookIds } replace membership (books that stay keep their added date)
DELETE /api/collections/:id             delete the collection (books stay on the shelf)

# Admin only. Anyone else (signed in or not) gets the same 404 as a route that doesn't exist.
GET    /api/admin/tables                every table: columns (type, nullable, editable, key, foreign key) + row count
GET    /api/admin/tables/:table/rows    ?page=&q=&sort=&dir= → 50 rows a page; files shown as sizes, JSON as a preview
PATCH  /api/admin/tables/:table/rows    { key, values } → edit one row (validated per column type; 409 on duplicates)
DELETE /api/admin/tables/:table/rows    { key } → delete one row (cascades)
POST   /api/admin/users/:id/reset-password   → { password } temporary password; signs the user out everywhere
```

### Where it can be reached

By default, the server and Postgres listen only on `127.0.0.1`, so only this computer can open the app. If you want to read on your phone or another computer on the **same Wi-Fi**, set `HOST=0.0.0.0` in `.env`. Accounts keep each person's books separate either way. Postgres itself always stays on localhost.

**Decided (2026-11-22):** sign-in is for this computer only for now, so `HOST` stays `127.0.0.1`.

Putting the app on the public internet (with a domain, HTTPS, and real email for password resets) isn't part of v1, but it's planned for later. To keep that path open:
- The cookie's `Secure` flag turns on automatically when `APP_ORIGIN` is `https://`.
- The origin check reads `APP_ORIGIN` instead of a hard-coded localhost.
- The `users` table can take an `email_verified_at` column later without a redesign.
- Password resets go through one function that a mailer can call later.

The database data lives in a Docker volume (`athenaeum-pg`), which survives restarts and container rebuilds. `npm run db:backup` writes a `pg_dump` file to `backups/`.

## Build order

Each step ends with something you can run and look at.

1. ✅ **Scaffold** (done 2026-11-22): npm workspaces (client/server/shared), `docker-compose.yml`, `.env.example`, Fastify server with a `/api/health` route that checks the DB, Drizzle schema + first migration, Vite client with routing, design tokens, fonts, header, empty shelf.
2. ✅ **Accounts** (done 2026-11-22): signup/login/logout/me routes, session cookies, origin check, rate limit, sign-in/sign-up pages, route guard, header account menu, `user:reset-password` script. Tests: login works, wrong password fails, expired sessions are rejected and near-expiry ones renewed, only token hashes are stored, cross-site requests are blocked. The "user B can't see user A's books" tests move to step 3, since that's when the first book routes exist.
3. ✅ **EPUB + PDF import** (done 2026-11-22, built test-first): EPUB and PDF parsers, the books API (upload, list, detail, chapter, cover, images, original file, progress, read flags, delete), upload from the header button, the empty-shelf button or drag-and-drop, an upload progress panel, and the atsu-style cover grid. Each account's books are isolated, with tests for every route. Checked against a real Project Gutenberg EPUB and a printed PDF of the same book: both give the same 12 chapters.
4. ✅ **Reader core** (done 2026-11-22): the atsu reading column (Site theme, measured typography, 554px measure), title + "N words · M min", chapter panel, prev/next links and ←/→ keys, chapters marked read on finishing, position saved while you scroll and restored when you return. The reader's toolbar links back to the book page.
5. **Settings panel**: all themes, fonts, sliders, toggles, Chapters tab, settings saved to your account. (The reader already reads every value from CSS variables, so this step only adds the panel and the settings API.)
6. **DOCX and TXT import**: reuse `domToBlocks` (DOCX via mammoth's HTML) and the PDF importer's chapter detection.
7. ◐ **Book page** (mostly done 2026-11-22, built test-first). Shelf cards open `/book/:id`, an atsu-style novel page with:
   - the serif title, the cover, and a Start reading / Continue button that follows saved progress
   - Download original
   - stats and a TYPE / PROGRESS / AUTHOR row, plus the description
   - a chapter list with search, All / Read / Unread filters, a sort toggle, a read checkbox on each row, and the current chapter marked

   Still to do: edit title/author and delete book. The API for delete already exists.
7b. ✅ **Collections** (done 2026-11-22, built test-first). A "Your Collections" row sits above "Your Shelf", showing each collection as a cover mosaic with its name and book count. **New collection** opens a dialog to name it and tick books (with a filter). Inside a collection: one tab per book (ordered by Date added, newest first, or A–Z). The selected tab shows that book's full page (cover, Continue, details, chapter list), and the chosen tab is kept in the address (`?book=`). Edit (rename and change books) and Delete (the books stay) are in the header. A book can be in several collections; deleting a book removes it from them.
8. **Shelf + account polish**: Continue Reading row, search, sort, progress badges, generated covers, account page, mobile layout, `db:backup` script.
9. **Verify**: run the whole stack with sample public-domain books (from Project Gutenberg, in each format). Create two accounts and confirm they can't see each other's books. Click through every feature in a browser at desktop and phone widths, restart the containers to confirm the data survives, then run the tests and build.

## What you'll need to run it

- **Docker Desktop** is installed but wasn't running when I checked. Start it before `docker compose up -d`.
- You have an old `C:\Program Files\PostgreSQL\17\data` folder but no Postgres server installed. It doesn't conflict with anything; Docker gets its own copy.
- If something else ever takes port 5432, change it in `.env`.
- You said you'll set up git yourself. A `.gitignore` is already in place (it excludes `.env`, `node_modules`, builds, and backups).

## Out of scope for v1

Read-aloud (TTS), social features, public internet hosting, password-reset emails, sign-in with Google or other providers, highlights/notes, scanned PDFs (OCR), and comic or image-heavy layouts.
