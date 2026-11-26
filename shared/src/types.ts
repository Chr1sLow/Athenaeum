// API types shared by the client and server. Never redeclare these on either side.

export type BookFormat = 'epub' | 'pdf' | 'docx' | 'txt';

/** One unit of normalized chapter content. The reader renders only this shape. */
export type Block =
  | { type: 'p'; text: string; html?: string }
  | { type: 'h'; level: 2 | 3 | 4; text: string }
  | { type: 'hr' }
  | { type: 'img'; imageId: string; alt?: string }
  /**
   * A footnote (an author's or translator's note). Importers put a chapter's notes after its text,
   * where the reader lists them under a short rule; `label` is the number its `<sup>` marker shows.
   */
  | { type: 'note'; label: string; text: string; html?: string };

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Returned by signup and login. */
export interface AuthResponse {
  user: User;
}

/** Returned by GET /auth/me. `null` when signed out (a 200, so browsers don't log an error). */
export interface MeResponse {
  user: User | null;
}

/** Shared validation limits, so the forms and the server agree. */
export const PASSWORD_MIN_LENGTH = 8;

export interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  hasCover: boolean;
  chapterCount: number;
  wordCount: number;
  /** 0–100, from saved progress. */
  percent: number;
  /** Chapter to open when continuing (0 if never opened). */
  chapterIndex: number;
  addedAt: string;
  lastReadAt: string | null;
  pinned: boolean;
}

/** PUT /books/:id/progress body. */
export interface ProgressInput {
  chapterIndex: number;
  blockIndex: number;
  percent: number;
}

export const SUPPORTED_UPLOAD_EXTENSIONS = ['.epub', '.pdf'] as const;

export const COLLECTION_NAME_MAX = 80;

/** A collection as shown on the shelf. */
export interface CollectionSummary {
  id: string;
  name: string;
  bookCount: number;
  /** Up to four books (most recently added first) for the cover mosaic. */
  previewBooks: { id: string; title: string; hasCover: boolean }[];
  createdAt: string;
}

export interface CollectionBook extends BookSummary {
  /** When the book was put in this collection. */
  addedToCollectionAt: string;
}

export interface CollectionDetail {
  id: string;
  name: string;
  createdAt: string;
  /** Most recently added to the collection first. */
  books: CollectionBook[];
}

/** POST /collections body. */
export interface CollectionInput {
  name: string;
  bookIds: string[];
}

export interface ChapterSummary {
  index: number;
  title: string;
  wordCount: number;
  read: boolean;
}

export interface BookDetail extends BookSummary {
  description: string | null;
  filename: string;
  sizeBytes: number;
  chapters: ChapterSummary[];
  progress: Progress | null;
}

/** An illustration shown in a chapter's gallery rather than in its text (PDF imports). */
export interface GalleryImage {
  /** Served by GET /books/:id/images/:imageId. */
  imageId: string;
  /** Size in pixels. */
  width: number;
  height: number;
}

export interface Chapter {
  bookId: string;
  index: number;
  title: string;
  wordCount: number;
  blocks: Block[];
  /** The chapter's illustrations, in page order; empty when it has none. */
  gallery: GalleryImage[];
}

export interface Progress {
  chapterIndex: number;
  blockIndex: number;
  percent: number;
  updatedAt: string;
}

export type ReaderTheme = 'site' | 'dim' | 'sepia' | 'light' | 'day' | 'night';
export type ReaderFont = 'serif' | 'georgia' | 'geist-serif' | 'sans' | 'lucida' | 'legible';

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  /** px, 14–28 */
  size: number;
  /** 300–700 */
  weight: number;
  /** 1.4–2.2 */
  lineHeight: number;
  /** characters per line, 40–100 */
  lineWidth: number;
  /** px, 0–2 */
  letterSpacing: number;
  /** px, 4–40 */
  paragraphSpacing: number;
  justify: boolean;
  indent: boolean;
  progressIndicator: 'percent' | 'chapter';
  continuousScroll: boolean;
}

/** Defaults measured from the atsu.moe reader. */
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'site',
  font: 'serif',
  size: 18,
  weight: 400,
  lineHeight: 1.6,
  lineWidth: 66,
  letterSpacing: 0,
  paragraphSpacing: 16,
  justify: false,
  indent: false,
  progressIndicator: 'percent',
  continuousScroll: false,
};

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  time: string;
}

export interface ApiError {
  error: string;
}

// ---- Admin dashboard (/admin). Every /api/admin route is a 404 for anyone who isn't an admin. ----

/**
 * How the dashboard shows and edits a column. `binary` cells hold the size in bytes and `json`
 * cells a shortened preview; both are read-only.
 */
export type AdminColumnType = 'text' | 'uuid' | 'integer' | 'number' | 'boolean' | 'timestamp' | 'enum' | 'json' | 'binary';

export interface AdminColumn {
  /** The column's name in Postgres, e.g. `user_id`. */
  name: string;
  type: AdminColumnType;
  nullable: boolean;
  editable: boolean;
  primaryKey: boolean;
  /** Allowed values of an `enum` column. */
  enumValues?: string[];
  /** The table this column points to (a foreign key to that table's primary key). */
  references?: string;
}

export interface AdminTable {
  name: string;
  rowCount: number;
  /** Primary key column names; together they identify one row. */
  primaryKey: string[];
  /** `users.password_hash` is never listed or sent. */
  columns: AdminColumn[];
}

export type AdminCell = string | number | boolean | null;
export type AdminRow = Record<string, AdminCell>;

/** GET /admin/tables/:table/rows?page=&q=&sort=&dir= */
export interface AdminRowsResponse {
  rows: AdminRow[];
  /** Rows matching the search, across all pages. */
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/** PATCH /admin/tables/:table/rows body. `key` holds the primary key values of the row to change. */
export interface AdminRowUpdate {
  key: AdminRow;
  values: AdminRow;
}

/** DELETE /admin/tables/:table/rows body. */
export interface AdminRowDelete {
  key: AdminRow;
}

/** POST /admin/users/:id/reset-password reply. */
export interface AdminPasswordReset {
  password: string;
}
