import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Block, GalleryImage, ReaderSettings } from '@athenaeum/shared';

/** Binary column. Never select these in list queries; stream them from dedicated routes. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const bookFormat = pgEnum('book_format', ['epub', 'pdf', 'docx', 'txt']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Always stored lowercase. */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    /** sha256(token) as hex. The raw token only ever lives in the user's cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    author: text('author'),
    description: text('description'),
    format: bookFormat('format').notNull(),
    cover: bytea('cover'),
    coverMime: text('cover_mime'),
    chapterCount: integer('chapter_count').notNull().default(0),
    wordCount: integer('word_count').notNull().default(0),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    pinned: boolean('pinned').notNull().default(false),
  },
  (t) => [index('books_user_last_read_idx').on(t.userId, t.lastReadAt)],
);

export const bookFiles = pgTable('book_files', {
  bookId: uuid('book_id')
    .primaryKey()
    .references(() => books.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  data: bytea('data').notNull(),
});

export const chapters = pgTable(
  'chapters',
  {
    id: serial('id').primaryKey(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    title: text('title').notNull(),
    wordCount: integer('word_count').notNull().default(0),
    blocks: jsonb('blocks').$type<Block[]>().notNull(),
    /** Illustrations shown in the chapter's gallery (PDF imports); ids point at book_images. */
    gallery: jsonb('gallery').$type<GalleryImage[]>().notNull().default([]),
  },
  (t) => [uniqueIndex('chapters_book_index_uq').on(t.bookId, t.index)],
);

export const bookImages = pgTable(
  'book_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    mime: text('mime').notNull(),
    data: bytea('data').notNull(),
  },
  (t) => [index('book_images_book_idx').on(t.bookId)],
);

export const progress = pgTable('progress', {
  bookId: uuid('book_id')
    .primaryKey()
    .references(() => books.id, { onDelete: 'cascade' }),
  chapterIndex: integer('chapter_index').notNull().default(0),
  blockIndex: integer('block_index').notNull().default(0),
  percent: real('percent').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

export const chapterReads = pgTable(
  'chapter_reads',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    chapterIndex: integer('chapter_index').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.chapterIndex] })],
);

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  // One name per user, ignoring capitalization.
  (t) => [uniqueIndex('collections_user_name_uq').on(t.userId, sql`lower(${t.name})`)],
);

export const collectionBooks = pgTable(
  'collection_books',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.bookId] }), index('collection_books_book_idx').on(t.bookId)],
);

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  reader: jsonb('reader').$type<ReaderSettings>().notNull(),
});
